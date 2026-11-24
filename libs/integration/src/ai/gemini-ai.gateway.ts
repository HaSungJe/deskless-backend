import {Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException} from '@nestjs/common';
import {GoogleGenAI} from '@google/genai';
import type {Content} from '@google/genai';
import {
    AI_API_VERSION,
    AI_CHAT_MODEL_DEFAULT,
    AI_EMBEDDING_DIMENSIONS,
    AI_EMBEDDING_MODEL_DEFAULT,
    AI_REQUEST_TIMEOUT_MS,
    AI_STREAM_TIMEOUT_MS,
    AI_UNAVAILABLE_MESSAGE,
} from '../integration.constants.js';
import type {AiEmbedInput, AiGatewayInterface, AiHistoryItem, AiJsonInput, AiTextInput} from '../interfaces/integration.interface.js';

/**
 * 대화 모델 — GEMINI_CHAT_MODEL, 비면 AI_CHAT_MODEL_DEFAULT.
 *
 * @returns 모델 이름
 */
function readChatModel(): string {
    return process.env.GEMINI_CHAT_MODEL || AI_CHAT_MODEL_DEFAULT;
}

/**
 * 임베딩 모델 — GEMINI_EMBEDDING_MODEL, 비면 AI_EMBEDDING_MODEL_DEFAULT.
 *
 * @returns 모델 이름
 */
function readEmbeddingModel(): string {
    return process.env.GEMINI_EMBEDDING_MODEL || AI_EMBEDDING_MODEL_DEFAULT;
}

/**
 * 대화 기록 + 이번 말을 Gemini contents 로.
 *
 * @param history 대화 기록
 * @param content 이번 말
 * @returns contents
 */
function toGeminiContents(history: AiHistoryItem[], content: string): Content[] {
    return [...history.map((item) => ({role: item.role, parts: [{text: item.text}]})), {role: 'user', parts: [{text: content}]}];
}

/**
 * 끊기 신호에 제한 시간을 더한다 — 둘 중 먼저 오는 쪽으로 멈춘다.
 *
 * @param signal 끊기 신호
 * @param timeout_ms 제한 시간
 * @returns 합친 신호
 */
function withTimeout(signal: AbortSignal, timeout_ms: number): AbortSignal {
    return AbortSignal.any([signal, AbortSignal.timeout(timeout_ms)]);
}

/**
 * 끊기 신호로 멈춘 것인지 — 이용자가 연결을 끊은 경우라 503 으로 바꾸지 않는다(제한 시간은 합친 신호라 이 신호가 아니다 — 503).
 *
 * @param signal 호출에 넘긴 끊기 신호
 * @returns 끊김이면 true
 */
function isAborted(signal: AbortSignal): boolean {
    return signal.aborted;
}

/**
 * 웹 검색(Google 검색 그라운딩)을 쓸 수 있는지 — GEMINI_SEARCH_ENABLED 가 '0' 이면 끈다(무료 등급 키는 그라운딩을 쓸 수 없다), 비거나 그 밖의 값이면 켠다.
 * 꺼져 있으면 도메인이 검색을 원해도 도구 없이 부른다 — 지역 · 위치를 모델이 아는 지식으로만 답한다.
 *
 * @returns 쓸 수 있으면 true
 */
function isSearchEnabled(): boolean {
    return process.env.GEMINI_SEARCH_ENABLED !== '0';
}

/**
 * AI 어댑터 — Google Gemini(공식 SDK @google/genai). 키 GEMINI_API_KEY, 모델 GEMINI_CHAT_MODEL · GEMINI_EMBEDDING_MODEL, 웹 검색 GEMINI_SEARCH_ENABLED(0 이면 끔 — 무료 등급).
 * 지시문 · 응답 형식은 쓰는 도메인이 넘기고 여기서는 호출 · 실패 분류만 한다 — 끊기 신호(이용자가 연결을 끊음)는 그대로 던지고,
 * 그 밖(키 없음 · 한도 · 5xx · 네트워크 · 제한 시간 · JSON 아님 · 빈 벡터)은 모두 503 AI_UNAVAILABLE_MESSAGE. 세팅: docs/guides/gemini-setup.md
 */
@Injectable()
export class GeminiAiGateway implements AiGatewayInterface, OnApplicationBootstrap {
    private readonly logger = new Logger(GeminiAiGateway.name);
    private client: GoogleGenAI | null = null;

    /**
     * GEMINI_API_KEY 가 비어 있으면 부팅 때 한 번 경고한다. 부팅은 막지 않고 AI 요청만 실패한다. 웹 검색을 껐으면 그것도 한 번 알린다.
     */
    onApplicationBootstrap(): void {
        if (!process.env.GEMINI_API_KEY) {
            this.logger.warn('GEMINI_API_KEY 가 비어 있어 AI 대화형 검색 · 업체 검색 벡터를 쓸 수 없습니다 — docs/guides/gemini-setup.md');
        }
        if (!isSearchEnabled()) {
            this.logger.log('GEMINI_SEARCH_ENABLED=0 — 웹 검색(Google 검색 그라운딩) 없이 답합니다(무료 등급 키)');
        }
    }

    /**
     * 정해진 JSON 형식의 답 하나 — 웹 검색(Google 검색 그라운딩)을 같이 쓸 수 있다.
     *
     * @param input 지시문 · 대화 기록 · 이번 말 · 웹 검색 · JSON Schema · 끊기 신호
     * @returns JSON 을 읽은 값
     */
    async generateJson(input: AiJsonInput): Promise<unknown> {
        const text = await this.call('JSON 응답', input.signal, async () => {
            const response = await this.genai().models.generateContent({
                model: readChatModel(),
                contents: toGeminiContents(input.history, input.content),
                config: {
                    systemInstruction: input.system,
                    tools: input.use_search && isSearchEnabled() ? [{googleSearch: {}}] : undefined,
                    responseMimeType: 'application/json',
                    responseJsonSchema: input.schema,
                    abortSignal: withTimeout(input.signal, AI_REQUEST_TIMEOUT_MS),
                },
            });
            return response.text ?? '';
        });
        try {
            return JSON.parse(text) as unknown;
        } catch {
            this.logger.error('JSON 응답 실패: JSON 이 아닌 답');
            throw new ServiceUnavailableException({message: AI_UNAVAILABLE_MESSAGE});
        }
    }

    /**
     * 답 글을 조각으로 흘린다 — 전체 제한 시간 AI_STREAM_TIMEOUT_MS(60초, 넘기면 503) · 끊기 신호를 따른다.
     *
     * @param input 지시문 · 대화 기록 · 이번 말 · 웹 검색 · 끊기 신호
     * @returns 글 조각
     */
    async *streamText(input: AiTextInput): AsyncIterable<string> {
        const stream = await this.call('글 스트리밍 시작', input.signal, () =>
            this.genai().models.generateContentStream({
                model: readChatModel(),
                contents: toGeminiContents(input.history, input.content),
                config: {
                    systemInstruction: input.system,
                    tools: input.use_search && isSearchEnabled() ? [{googleSearch: {}}] : undefined,
                    abortSignal: withTimeout(input.signal, AI_STREAM_TIMEOUT_MS),
                },
            }),
        );
        try {
            for await (const chunk of stream) {
                if (chunk.text) {
                    yield chunk.text;
                }
            }
        } catch (error) {
            throw this.toFailure('글 스트리밍', error, input.signal);
        }
    }

    /**
     * 글마다 벡터 — 받은 순서대로, AI_EMBEDDING_DIMENSIONS 차원.
     *
     * @param input 글 목록 · 용도 · 끊기 신호
     * @returns 벡터 목록
     */
    async embed(input: AiEmbedInput): Promise<number[][]> {
        if (input.texts.length === 0) {
            return [];
        }
        const vectors = await this.call('임베딩', input.signal, async () => {
            const response = await this.genai().models.embedContent({
                model: readEmbeddingModel(),
                contents: input.texts,
                config: {
                    taskType: input.task === 'DOCUMENT' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
                    outputDimensionality: AI_EMBEDDING_DIMENSIONS,
                    abortSignal: withTimeout(input.signal, AI_REQUEST_TIMEOUT_MS),
                },
            });
            return (response.embeddings ?? []).map((item) => item.values ?? []);
        });
        if (vectors.length !== input.texts.length || vectors.some((values) => values.length !== AI_EMBEDDING_DIMENSIONS)) {
            this.logger.error(`임베딩 실패: 벡터 수 · 차원이 다름(${vectors.length}/${input.texts.length})`);
            throw new ServiceUnavailableException({message: AI_UNAVAILABLE_MESSAGE});
        }
        return vectors;
    }

    /**
     * SDK 클라이언트(API v1beta) — 키가 비면 503(부팅은 된다).
     *
     * @returns 클라이언트
     * @throws ServiceUnavailableException `{message: AI_UNAVAILABLE_MESSAGE}`
     */
    private genai(): GoogleGenAI {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new ServiceUnavailableException({message: AI_UNAVAILABLE_MESSAGE});
        }
        if (!this.client) {
            // API 버전 v1beta 고정 — SDK 기본 v1 에는 미리보기 모델 · 정해진 JSON 응답 · 검색 그라운딩이 없다
            this.client = new GoogleGenAI({apiKey, apiVersion: AI_API_VERSION});
        }
        return this.client;
    }

    /**
     * Gemini 호출 1번 — 실패를 분류한다(끊김은 그대로, 그 밖은 503).
     *
     * @param action 로그에 남길 동작 이름
     * @param signal 호출에 넘긴 끊기 신호
     * @param request 호출
     * @returns 호출 결과
     */
    private async call<T>(action: string, signal: AbortSignal, request: () => Promise<T>): Promise<T> {
        try {
            return await request();
        } catch (error) {
            throw this.toFailure(action, error, signal);
        }
    }

    /**
     * 실패 분류 — 끊기 신호면 그 오류 그대로, 이미 503 이면 그대로, 그 밖은 로그를 남기고 503.
     *
     * @param action 로그에 남길 동작 이름
     * @param error 실패
     * @param signal 호출에 넘긴 끊기 신호
     * @returns 던질 오류
     */
    private toFailure(action: string, error: unknown, signal: AbortSignal): unknown {
        if (isAborted(signal) || error instanceof ServiceUnavailableException) {
            return error;
        }
        this.logger.error(`${action} 실패: ${(error as Error)?.message ?? error}`);
        return new ServiceUnavailableException({message: AI_UNAVAILABLE_MESSAGE});
    }
}
