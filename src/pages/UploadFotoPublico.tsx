// TODO(US-07-01): upload de foto via link público não implementado no MVP.

export function UploadFotoPublico() {
  return (
    <div className="min-h-screen flex items-start justify-center pt-[12vh] px-4 bg-pietra-clara/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-display text-2xl text-verde">
            Festa da Achiropita
          </div>
          <div className="text-ardesia text-sm mt-1">100ª edição · 2026</div>
        </div>
        <div className="card shadow-media">
          <div className="card-corpo space-y-3 text-center">
            <h3 className="m-0">Recurso indisponível</h3>
            <p className="text-ardesia text-sm">
              O envio de fotos por link não está disponível nesta versão.
              Fale com a organização.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
