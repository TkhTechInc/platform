import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

export const IS_PUBLIC = 'isPublic';

/** Mark a route as public — bypasses JwtAuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Shorthand for @UseGuards(JwtAuthGuard). */
export const Auth = () => applyDecorators(UseGuards(JwtAuthGuard));
