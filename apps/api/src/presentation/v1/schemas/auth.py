from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.domain.identity.enums import UserRole


class LoginIn(BaseModel):
    email: EmailStr
    # O teto de 128 não é estética: sem limite, alguém manda uma senha de 10 MB
    # e o bcrypt (que é lento de propósito) vira um vetor de negação de serviço.
    # O piso de 8 é o mínimo do OWASP.
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: UserRole
    dealership_id: UUID | None


class SessionOut(BaseModel):
    """Resposta do login e da renovação.

    O refresh token NÃO aparece aqui: ele vai num cookie httpOnly, que o
    JavaScript não consegue ler. Devolvê-lo no corpo obrigaria o frontend a
    guardá-lo em algum lugar acessível a scripts — e aí um XSS levaria a sessão
    inteira, com validade de sete dias.
    """

    access_token: str
    token_type: str = "bearer"  # noqa: S105 — é o nome do esquema HTTP, não uma senha
    expires_in: int
    user: UserOut
