import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarDays,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  Download,
} from "lucide-react";
import { User, PuntoAtencion, Moneda } from "@/types";
import { useContabilidadDivisas } from "@/hooks/useContabilidadDivisas";
import { useContabilidadAdmin } from "@/hooks/useContabilidadAdmin";
import { Loading } from "@/components/ui/loading";

// Dropdown con checkboxes (shadcn)
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

interface HistorialMovimientosProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies?: Moneda[];
  isAdminView?: boolean;
}

type Movimiento = {
  id: string;
  fecha: string | Date;
  tipo_movimiento:
    | "INGRESO"
    | "EGRESO"
    | "TRANSFERENCIA_ENTRANTE"
    | "TRANSFERENCIA_SALIENTE";
  tipo_referencia?: string | null;
  referencia_id?: string | null;
  moneda_codigo: string;
  monto: number;
  punto_nombre?: string;
  descripcion?: string | null;
};

export default function HistorialMovimientos({
  user,
  selectedPoint,
  currencies,
  isAdminView = false,
}: HistorialMovimientosProps) {
  const normal = useContabilidadDivisas({ user, selectedPoint });
  const admin = useContabilidadAdmin({ user });

  const { movimientos, isLoading, error, refresh } = isAdminView
    ? {
        movimientos: admin.movimientosConsolidados as Movimiento[],
        isLoading: admin.isLoading,
        error: admin.error,
        refresh: admin.refresh,
      }
    : (normal as any);

  // ===== UI State =====
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<"fecha" | "monto">("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tipo, setTipo] = useState<"ALL" | Movimiento["tipo_movimiento"]>(
    "ALL"
  );
  const [moneda, setMoneda] = useState<string>("ALL");

  // Columnas opcionales para CSV
  const [csvCols, setCsvCols] = useState({
    id: false,
    tipoRef: false,
    refId: false,
  });

  // Reset paginación si cambian filtros
  useEffect(() => {
    setPage(1);
  }, [query, pageSize, sortKey, sortDir, tipo, moneda]);

  // ===== Opciones de divisa usando currencies si está disponible =====
  const monedaOptions = useMemo(() => {
    const set = new Set<string>();
    (movimientos ?? []).forEach((m: any) => set.add(m.moneda_codigo));
    let list = Array.from(set);

    // Si tenemos currencies, usamos su orden
    if (currencies?.length) {
      const order = new Map<string, number>();
      currencies.forEach((c, i) => order.set(c.codigo, i));
      list.sort((a, b) => {
        const ia = a === "USD" ? -1 : order.get(a) ?? Number.MAX_SAFE_INTEGER;
        const ib = b === "USD" ? -1 : order.get(b) ?? Number.MAX_SAFE_INTEGER;
        return ia - ib || a.localeCompare(b);
      });
    } else {
      // Si no hay currencies, USD primero y resto alfabético
      list.sort((a, b) => (a === "USD" ? -1 : a.localeCompare(b)));
    }

    return ["ALL", ...list];
  }, [movimientos, currencies]);

  // ===== Filtrado y orden =====
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = (movimientos ?? []) as Movimiento[];
    let base = arr.filter((m) => {
      if (tipo !== "ALL" && m.tipo_movimiento !== tipo) return false;
      if (moneda !== "ALL" && m.moneda_codigo !== moneda) return false;
      if (!q) return true;
      const hay = `${m.descripcion ?? ""} ${m.tipo_movimiento} ${
        m.tipo_referencia ?? ""
      } ${m.moneda_codigo} ${m.punto_nombre ?? ""}`.toLowerCase();
      return hay.includes(q);
    });

    base.sort((a, b) => {
      if (sortKey === "fecha") {
        const da = new Date(a.fecha).getTime();
        const db = new Date(b.fecha).getTime();
        return sortDir === "asc" ? da - db : db - da;
      } else {
        return sortDir === "asc" ? a.monto - b.monto : b.monto - a.monto;
      }
    });

    return base;
  }, [movimientos, query, tipo, moneda, sortKey, sortDir]);

  // ===== Paginación =====
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ===== Helpers =====
  const fmtMoney = (n: number, code: string) =>
    code === "USD"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(n)
      : new Intl.NumberFormat("es-ES", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(n);

  const tipoBadgeClass = (t: Movimiento["tipo_movimiento"]) =>
    t === "INGRESO" || t === "TRANSFERENCIA_ENTRANTE"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";

  // ===== CSV Export =====
  const csvEscape = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const buildCsv = (rows: Movimiento[], admin: boolean) => {
    const headersBase = ["Fecha", "Tipo", "Moneda", "Monto"];
    const headersExtra = [
      ...(admin ? ["Punto"] : []),
      "Descripción",
      ...(csvCols.id ? ["ID"] : []),
      ...(csvCols.tipoRef ? ["Tipo referencia"] : []),
      ...(csvCols.refId ? ["Referencia ID"] : []),
    ];
    const headers = [...headersBase, ...headersExtra];

    const lines = rows.map((m) => {
      const fecha = new Date(m.fecha).toISOString(); // formato estable
      const base = [
        csvEscape(fecha),
        csvEscape(m.tipo_movimiento),
        csvEscape(m.moneda_codigo),
        String(m.monto),
      ];
      const extra = [
        ...(admin ? [csvEscape(m.punto_nombre ?? "")] : []),
        csvEscape(m.descripcion ?? ""),
        ...(csvCols.id ? [csvEscape(m.id)] : []),
        ...(csvCols.tipoRef ? [csvEscape(m.tipo_referencia ?? "")] : []),
        ...(csvCols.refId ? [csvEscape(m.referencia_id ?? "")] : []),
      ];
      return [...base, ...extra].join(",");
    });

    return [headers.join(","), ...lines].join("\n");
  };

  const downloadCsv = (filename: string, csv: string) => {
    // BOM para Excel UTF-8
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportPage = () => {
    const csv = buildCsv(current, !!isAdminView);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`movimientos_pagina_${page}_${ts}.csv`, csv);
  };

  const handleExportAll = () => {
    const csv = buildCsv(filtered, !!isAdminView);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`movimientos_filtrados_${ts}.csv`, csv);
  };

  return (
    <Card>
      <CardHeader className="pb-2 sticky top-0 z-[1] bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 rounded-t-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Historial de Movimientos
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Buscar */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar descripción, punto, tipo…"
                className="pl-8 w-64 h-9"
              />
            </div>

            {/* Tipo */}
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="INGRESO">Ingreso</SelectItem>
                <SelectItem value="EGRESO">Egreso</SelectItem>
                <SelectItem value="TRANSFERENCIA_ENTRANTE">
                  Transf. entrante
                </SelectItem>
                <SelectItem value="TRANSFERENCIA_SALIENTE">
                  Transf. saliente
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Moneda */}
            <Select value={moneda} onValueChange={setMoneda}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                {monedaOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === "ALL" ? "Todas" : m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Orden */}
            <Select value={sortKey} onValueChange={(v: any) => setSortKey(v)}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fecha">Fecha</SelectItem>
                <SelectItem value="monto">Monto</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? "Ascendente" : "Descendente"}
            >
              {sortDir === "asc" ? (
                <ArrowUpNarrowWide className="h-4 w-4" />
              ) : (
                <ArrowDownWideNarrow className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-9"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            {/* Exportar CSV - Página / Todos + Campos */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    Campos CSV
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Incluir columnas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={csvCols.id}
                    onCheckedChange={(v) =>
                      setCsvCols((s) => ({ ...s, id: Boolean(v) }))
                    }
                  >
                    ID
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={csvCols.tipoRef}
                    onCheckedChange={(v) =>
                      setCsvCols((s) => ({ ...s, tipoRef: Boolean(v) }))
                    }
                  >
                    Tipo de referencia
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={csvCols.refId}
                    onCheckedChange={(v) =>
                      setCsvCols((s) => ({ ...s, refId: Boolean(v) }))
                    }
                  >
                    Referencia ID
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleExportPage}
                disabled={current.length === 0}
                title="Exportar CSV (página actual)"
              >
                <Download className="h-4 w-4 mr-1" />
                Página
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleExportAll}
                disabled={filtered.length === 0}
                title="Exportar CSV (todos los resultados)"
              >
                <Download className="h-4 w-4 mr-1" />
                Todo
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3">
        {isLoading && (movimientos?.length ?? 0) === 0 ? (
          <Loading text="Cargando movimientos..." className="py-10" />
        ) : error ? (
          <div className="text-center py-10 text-red-600">{error}</div>
        ) : (movimientos?.length ?? 0) === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No hay movimientos
          </div>
        ) : (
          <>
            {/* Tabla */}
            <div className="w-full overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-[1]">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">
                      <CalendarDays className="inline h-4 w-4 mr-1" />
                      Fecha
                    </th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Moneda</th>
                    <th className="px-3 py-2 font-medium text-right">Monto</th>
                    {isAdminView && (
                      <th className="px-3 py-2 font-medium">Punto</th>
                    )}
                    <th className="px-3 py-2 font-medium">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((m) => (
                    <tr key={m.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(m.fecha).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${tipoBadgeClass(
                            m.tipo_movimiento
                          )}`}
                        >
                          {m.tipo_movimiento.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2">{m.moneda_codigo}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {fmtMoney(m.monto, m.moneda_codigo)}
                      </td>
                      {isAdminView && (
                        <td className="px-3 py-2">{m.punto_nombre ?? "—"}</td>
                      )}
                      <td className="px-3 py-2 max-w-[320px]">
                        <div className="line-clamp-2 text-muted-foreground">
                          {m.descripcion ?? "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              <div className="text-xs text-gray-600">
                Mostrando <b>{current.length}</b> de <b>{total}</b> registros •
                Página <b>{page}</b> de <b>{totalPages}</b>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue placeholder="Tamaño" />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / pág
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                  >
                    ⏮
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ◀
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ▶
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    ⏭
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
