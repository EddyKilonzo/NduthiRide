import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { RegisterRiderDto } from './dto/register-rider.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Account } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Registration ─────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({
    summary: 'Register a new passenger account (alias for /register/user)',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created — returns token pair',
  })
  @ApiResponse({ status: 409, description: 'Phone number already registered' })
  register(@Body() dto: RegisterUserDto) {
    return this.authService.registerUser(dto);
  }

  @Post('register/user')
  @ApiOperation({ summary: 'Register a new passenger account' })
  @ApiResponse({
    status: 201,
    description: 'Account created — returns token pair',
  })
  @ApiResponse({ status: 409, description: 'Phone number already registered' })
  registerUser(@Body() dto: RegisterUserDto) {
    return this.authService.registerUser(dto);
  }

  @Post('register/rider')
  @ApiOperation({ summary: 'Register a new rider account with bike details' })
  @ApiResponse({
    status: 201,
    description: 'Rider account created — returns token pair',
  })
  @ApiResponse({ status: 409, description: 'Phone number already registered' })
  registerRider(@Body() dto: RegisterRiderDto) {
    return this.authService.registerRider(dto);
  }

  // ─── Login / token management ─────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email/phone and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful — returns token pair',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiResponse({
    status: 200,
    description: 'Returns a new access + refresh token pair',
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired' })
  refreshTokens(@CurrentUser() user: Account & { rawRefreshToken: string }) {
    return this.authService.refreshTokens(user.id, user.rawRefreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke the current session (clears refresh token)',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@CurrentUser() user: Account) {
    return this.authService.logout(user.id);
  }

  // ─── Email verification (OTP) ─────────────────────────────────────

  @Post('email/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit the 6-digit OTP to verify your email address',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  verifyEmail(@CurrentUser() user: Account, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(user.id, dto.otp);
  }

  @Post('email/resend-otp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend the email verification OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent' })
  resendOtp(@CurrentUser() user: Account) {
    return this.authService.resendVerificationOtp(user.id);
  }

  // ─── Password reset ───────────────────────────────────────────────

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password-reset link by email' })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset link has been sent',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using the token from the reset email',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password while signed in',
    description:
      'Clears refresh tokens on the server; other devices must sign in again.',
  })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({ status: 401, description: 'Wrong current password' })
  changePassword(
    @CurrentUser() user: Account,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
