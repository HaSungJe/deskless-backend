import {ApiProperty} from '@nestjs/swagger';
import {IsIn, IsOptional} from 'class-validator';

/**
 * 내 업체 편의시설 설정 (업체 관리자) — 통째로 교체. 항목은 모두 선택이고 빠진 항목은 없음(0)으로 저장한다. 선언하지 않은 항목은 400(forbidNonWhitelisted).
 */
export class StoreMineDetailDto {
    @ApiProperty({description: '편의점 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '편의점 여부가 올바르지 않습니다.'})
    has_convenience_store?: number;

    @ApiProperty({description: '카페 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '카페 여부가 올바르지 않습니다.'})
    has_cafe?: number;

    @ApiProperty({description: '온천 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '온천 여부가 올바르지 않습니다.'})
    has_hot_spring?: number;

    @ApiProperty({description: '반려동물 동반 가능 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '반려동물 동반 가능 여부가 올바르지 않습니다.'})
    is_pet_allowed?: number;

    @ApiProperty({description: '식사 제공 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '식사 제공 여부가 올바르지 않습니다.'})
    has_meal?: number;

    @ApiProperty({description: '배달 음식 가능 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '배달 음식 가능 여부가 올바르지 않습니다.'})
    is_delivery_allowed?: number;

    @ApiProperty({description: '주차 가능 (0: 없음, 1: 있음)', required: false, enum: [0, 1]})
    @IsOptional()
    @IsIn([0, 1], {message: '주차 가능 여부가 올바르지 않습니다.'})
    has_parking?: number;
}
