'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { errorMessage, http } from '@/lib/http';

/**
 * Catálogo de marcas e modelos.
 *
 * ============================================================================
 * POR QUE ESTA TELA EXISTE
 * ============================================================================
 * O catálogo NUNCA vai estar completo. São milhares de modelos no mercado
 * brasileiro, e a lista que veio pronta — 24 marcas, 246 modelos — cobre bem o
 * que roda hoje mas é fina em carro antigo, que é justamente a faixa mais barata
 * que uma revenda vende. Monza, Santana, Escort, Tempra: nenhum está lá.
 *
 * Sem esta tela, faltando um modelo o vendedor trava no `<select>` do cadastro e
 * a única saída é ligar para um programador. Na prática isso significa não
 * cadastrar o carro — e o carro que não entra no site não vende.
 *
 * ============================================================================
 * SÓ CRIA, NÃO APAGA
 * ============================================================================
 * De propósito. Marca e modelo são referenciados por veículos e por pedidos da
 * lista de espera; apagar deixaria registros órfãos ou faria a exclusão falhar
 * com um erro de banco cru. Sobrou marca errada, ela fica — invisível, porque o
 * filtro do site só mostra o que tem carro à venda.
 */

type Modelo = { id: string; name: string };
type Marca = { id: string; name: string; models: Modelo[] };

export default function AdminCatalogoPage() {
  const [marcas, setMarcas] = useState<Marca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  // Um contador que só serve de gatilho: os formulários abaixo o incrementam
  // depois de criar, e o efeito recarrega. `setState` a partir de um clique é
  // trivial; chamar uma função que muda estado DENTRO do efeito é que dispara
  // renderização em cascata — foi o que o lint apontou na primeira versão.
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let cancelado = false;

    http
      .get<{ brands: Marca[] }>('/admin/catalog')
      .then(({ data }) => {
        if (cancelado) return;
        setMarcas(data.brands);
        setErro(null);
      })
      .catch((e) => {
        if (!cancelado) setErro(errorMessage(e));
      });

    return () => {
      cancelado = true;
    };
  }, [versao]);

  const termo = busca.trim().toLowerCase();
  const visiveis = (marcas ?? []).filter(
    (m) =>
      !termo ||
      m.name.toLowerCase().includes(termo) ||
      m.models.some((mo) => mo.name.toLowerCase().includes(termo)),
  );

  const total = (marcas ?? []).reduce((soma, m) => soma + m.models.length, 0);

  return (
    <div>
      <h1 className="text-content text-2xl font-bold tracking-tight">Catálogo</h1>
      <p className="text-muted mt-1 text-sm">
        As marcas e modelos que aparecem no cadastro de veículo e na lista de espera.
      </p>

      {erro && (
        <div
          role="alert"
          className="rounded-btn bg-danger-500/10 text-danger-700 mt-5 flex items-start gap-2.5 p-3.5 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <NovaMarca onPronto={recarregar} />
        <NovoModelo marcas={marcas ?? []} onPronto={recarregar} />
      </div>

      <div className="relative mt-8">
        <Search className="text-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar marca ou modelo"
          className="pl-9"
          aria-label="Procurar no catálogo"
        />
      </div>

      {marcas && (
        <p className="text-faint mt-4 text-sm">
          <strong className="text-content font-semibold">{marcas.length}</strong> marcas ·{' '}
          <strong className="text-content font-semibold">{total}</strong> modelos
        </p>
      )}

      <div className="mt-4 space-y-3">
        {visiveis.map((marca) => (
          <div key={marca.id} className="rounded-card bg-surface ring-line p-5 ring-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-content font-semibold">{marca.name}</h2>
              <span className="text-faint text-xs">
                {marca.models.length} {marca.models.length === 1 ? 'modelo' : 'modelos'}
              </span>
            </div>
            {marca.models.length > 0 ? (
              <p className="text-muted mt-2 text-sm leading-relaxed">
                {marca.models.map((m) => m.name).join(' · ')}
              </p>
            ) : (
              <p className="text-faint mt-2 text-sm">
                Nenhum modelo ainda — cadastre acima para poder usar esta marca.
              </p>
            )}
          </div>
        ))}
      </div>

      {marcas && visiveis.length === 0 && (
        <p className="text-muted rounded-card bg-surface ring-line mt-4 p-8 text-center text-sm ring-1">
          Nada encontrado para “{busca}”. Se o modelo não existe, cadastre acima.
        </p>
      )}
    </div>
  );
}

function NovaMarca({ onPronto }: { onPronto: () => void }) {
  const [nome, setNome] = useState('');
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'ok'>('parado');
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setEstado('salvando');
    setErro(null);
    try {
      await http.post('/admin/catalog/brands', { name: nome.trim() });
      setNome('');
      onPronto();
      setEstado('ok');
      setTimeout(() => setEstado('parado'), 2000);
    } catch (e) {
      setErro(errorMessage(e));
      setEstado('parado');
    }
  };

  return (
    <Cartao titulo="Nova marca" descricao="Ex.: Chery, JAC, Troller">
      <div className="flex gap-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da marca"
          aria-label="Nome da marca"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && nome.trim().length >= 2) void salvar();
          }}
        />
        <Botao
          estado={estado}
          desabilitado={nome.trim().length < 2}
          onClick={() => void salvar()}
        />
      </div>
      {erro && <p className="text-danger-700 mt-2 text-sm">{erro}</p>}
    </Cartao>
  );
}

function NovoModelo({ marcas, onPronto }: { marcas: Marca[]; onPronto: () => void }) {
  const [marcaId, setMarcaId] = useState('');
  const [nome, setNome] = useState('');
  const [estado, setEstado] = useState<'parado' | 'salvando' | 'ok'>('parado');
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setEstado('salvando');
    setErro(null);
    try {
      await http.post('/admin/catalog/models', { brand_id: marcaId, name: nome.trim() });
      setNome('');
      onPronto();
      setEstado('ok');
      setTimeout(() => setEstado('parado'), 2000);
    } catch (e) {
      setErro(errorMessage(e));
      setEstado('parado');
    }
  };

  const pronto = marcaId !== '' && nome.trim().length >= 1;

  return (
    <Cartao titulo="Novo modelo" descricao="Ex.: Monza, Santana, Escort">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={marcaId}
          onChange={(e) => setMarcaId(e.target.value)}
          aria-label="Marca do modelo"
          className="sm:w-44"
        >
          <option value="">Marca</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <div className="flex flex-1 gap-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do modelo"
            aria-label="Nome do modelo"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pronto) void salvar();
            }}
          />
          <Botao estado={estado} desabilitado={!pronto} onClick={() => void salvar()} />
        </div>
      </div>
      {erro && <p className="text-danger-700 mt-2 text-sm">{erro}</p>}
    </Cartao>
  );
}

function Cartao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-surface ring-line p-5 ring-1">
      <p className="text-content text-sm font-semibold">{titulo}</p>
      <p className="text-faint mt-0.5 mb-3 text-xs">{descricao}</p>
      {children}
    </div>
  );
}

function Botao({
  estado,
  desabilitado,
  onClick,
}: {
  estado: 'parado' | 'salvando' | 'ok';
  desabilitado: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={estado === 'ok' ? 'success' : 'primary'}
      disabled={desabilitado || estado === 'salvando'}
      onClick={onClick}
      className="shrink-0"
    >
      {estado === 'salvando' ? (
        <Loader2 className="size-4 animate-spin" />
      ) : estado === 'ok' ? (
        <Check className="size-4" />
      ) : (
        <Plus className="size-4" />
      )}
    </Button>
  );
}
