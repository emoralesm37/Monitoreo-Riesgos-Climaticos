export interface LoginResponseDto {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
}