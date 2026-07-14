"""Entrypoint da Vercel.

O runtime Python da Vercel procura um objeto ASGI chamado `app` neste módulo e
o serve. Todo o roteamento interno continua sendo do FastAPI; o `vercel.json`
apenas manda todo o tráfego para cá.

Este arquivo é deliberadamente fino — nenhuma lógica mora aqui, para que trocar
de plataforma de deploy signifique trocar um arquivo.
"""

from __future__ import annotations

import sys
from pathlib import Path

# A Vercel executa este arquivo a partir de `api/`, então a raiz do projeto
# (onde vive `src/`) precisa entrar no path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.main import app

__all__ = ["app"]
