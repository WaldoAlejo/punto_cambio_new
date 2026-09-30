// Fotos de ejemplo por prueba: cómo se hace, resultado bueno, menor ley y resultado malo.
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HallmarkStamp } from "./MetalIllustrations";
import { EXAMPLES, PHOTOS, type ExampleKey, type GuidePhoto, type PhotoKey } from "./metalPhotos";

const TONES = {
  como: { label: "Cómo se hace", box: "border-slate-300 bg-white", title: "text-slate-700" },
  bueno: { label: "✓ Resultado bueno", box: "border-green-400 bg-green-50", title: "text-green-800" },
  menor: { label: "◐ Oro de menor ley", box: "border-amber-400 bg-amber-50", title: "text-amber-800" },
  malo: { label: "✕ Resultado malo: no comprar", box: "border-red-400 bg-red-50", title: "text-red-800" },
};

function Thumb({ photo, size, onOpen }: { photo: GuidePhoto; size: "sm" | "md"; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="group overflow-hidden rounded-md border bg-white text-left" title="Ampliar">
    <img src={`/metal-guide/${photo.src}`} alt={photo.alt} loading="lazy" className={`${size === "sm" ? "h-20 w-28" : "h-32 w-full"} object-cover transition group-hover:opacity-90`} />
    {size === "md" && <span className="block p-1.5 text-xs leading-snug text-slate-700">{photo.caption}</span>}
  </button>;
}

export default function MetalPhotoExamples({ step, compact = false }: { step: ExampleKey; compact?: boolean }) {
  const [open, setOpen] = useState<GuidePhoto | null>(null);
  const ex: { como?: readonly PhotoKey[]; bueno?: readonly PhotoKey[]; menor?: readonly PhotoKey[]; malo?: readonly PhotoKey[]; buenoTexto?: string; menorTexto?: string; maloTexto?: string; sellosMalos?: readonly string[] } = EXAMPLES[step];
  const groups = (["como", "bueno", "menor", "malo"] as const).map(kind => ({ kind, keys: ex[kind] ?? [], text: kind === "bueno" ? ex.buenoTexto : kind === "menor" ? ex.menorTexto : kind === "malo" ? ex.maloTexto : undefined }))
    .filter(g => g.keys.length || g.text || (g.kind === "malo" && ex.sellosMalos?.length));
  const body = <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}>
    {groups.map(g => <div key={g.kind} className={`rounded-lg border p-2 ${TONES[g.kind].box}`}>
      <p className={`mb-1 text-xs font-bold ${TONES[g.kind].title}`}>{TONES[g.kind].label}</p>
      {g.text && <p className="mb-2 text-xs text-slate-700">{g.text}</p>}
      <div className={compact ? "flex flex-wrap gap-1.5" : "grid grid-cols-2 gap-2"}>{g.keys.map(k => <Thumb key={k} photo={PHOTOS[k]} size={compact ? "sm" : "md"} onOpen={() => setOpen(PHOTOS[k])} />)}</div>
      {g.kind === "malo" && ex.sellosMalos && <div className="mt-1 flex flex-wrap gap-1">{ex.sellosMalos.map(s => <HallmarkStamp key={s} text={s} className="h-7 w-14" />)}<p className="w-full text-[11px] text-slate-600">GF: gold filled · GP: gold plated (bañado) · HGE: baño grueso · RGP: laminado · 1/20: capa de oro · STEEL: acero</p></div>}
    </div>)}
  </div>;
  return <>
    {compact ? <details className="mt-2 rounded-md border bg-white/70 p-2"><summary className="cursor-pointer text-xs font-semibold text-blue-800">📷 Ver fotos: cómo se hace, bueno y malo</summary><div className="mt-2">{body}</div></details> : body}
    <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
      <DialogContent className="max-w-3xl">
        {open && <><DialogTitle className="text-base">{open.caption}</DialogTitle>
          <img src={`/metal-guide/${open.src}`} alt={open.alt} className="max-h-[70vh] w-full rounded object-contain" />
          <DialogDescription className="text-xs">{open.credit ? `${open.credit.titulo} — ${open.credit.autor} · ${open.credit.licencia}` : ""}</DialogDescription></>}
      </DialogContent>
    </Dialog>
  </>;
}
