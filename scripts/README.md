# scripts

## `recortar-carro.swift` — recorta o carro de uma foto

Gera o PNG sem fundo usado no hero da home (`apps/web/public/carro-hero.png`).

```sh
swift scripts/recortar-carro.swift foto-do-carro.jpg apps/web/public/carro-hero.png
```

Usa o **Vision do próprio macOS** — o mesmo motor por trás do "remover fundo"
do Preview. Roda offline: a foto não sai da máquina, não há chave de API nem
serviço de terceiros envolvido. Leva uns 40 segundos.

Depois do recorte, vale aparar a moldura transparente e comprimir:

```sh
cd apps/web && node -e "
const sharp = require('sharp');
sharp('public/carro-hero.png').trim({ threshold: 1 }).png({ compressionLevel: 9 })
  .toFile('public/carro-hero.tmp.png').then(i => console.log(i.width + 'x' + i.height));
" && mv public/carro-hero.tmp.png public/carro-hero.png
```

Ajuste `width`/`height` do `<Image>` em `src/features/home/hero.tsx` para as
medidas que o comando imprimir — é a proporção declarada ali que reserva o
espaço antes de a imagem carregar, e uma proporção errada faz a página saltar.

### Por que isto não roda no upload do anúncio

O Vision só existe no macOS, e a API roda em Linux na Vercel. Por isso o carro
do hero é **estático**: trocar a vitrine do topo exige rodar este script com
outra foto e commitar o resultado. Os veículos em destaque continuam saindo do
banco normalmente, na seção "Seleção da casa".
