interface Props {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}

export function PageHeader({ titulo, descricao, acoes }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {descricao && (
          <p className="text-sm text-slate-600 mt-1">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  );
}
