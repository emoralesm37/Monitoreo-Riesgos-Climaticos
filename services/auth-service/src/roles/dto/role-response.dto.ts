export interface RoleResponseDto {
  id: string;
  name: string;
  description: string | null;
  permissions: { method: string; path: string; label: string }[];
}
