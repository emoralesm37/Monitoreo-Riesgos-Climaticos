import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthSimuladoService {
  // Simulado: mientras no exista login real, se puede cambiar aquí para probar
  currentRole: 'Admin' | 'Operador' = 'Admin';

  isAdmin(): boolean {
    return this.currentRole === 'Admin';
  }
}