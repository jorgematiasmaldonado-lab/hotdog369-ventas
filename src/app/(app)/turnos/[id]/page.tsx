"use client";
import useSWR from "swr";
import { use, useState } from "react";
import Link from "next/link";
import { Printer, Share2, ArrowLeft, Wallet } from "lucide-react";
import { Button, ErrorBox, Loading, PageTitle } from "@/components/ui";
import { ShiftReport, shiftWhatsappText, type ShiftSummary } from "@/components/shift-report";
import { fetcher } from "@/lib/client/fetcher";
import { useMe } from "@/components/me";
import { OpeningModal } from "@/components/opening-cash";

export default function TurnoDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useMe();
  const { data, error, mutate } = useSWR<ShiftSummary>(`/api/shifts/${id}`, fetcher);
  const [edit, setEdit] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  // El empleado no ve el reporte con montos (cierre a ciegas)
  if ("blind" in data)
    return <div className="mx-auto mt-10 max-w-md text-center text-muted">Turno #{data.shift.id} · {data.shift.status === "cerrado" ? "cerrado. El administrador revisa el arqueo." : "abierto."}
      <div className="mt-4"><Link href="/vender"><Button>Volver</Button></Link></div></div>;
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(shiftWhatsappText(data))}`, "_blank");
  return (
    <div>
      <PageTitle title={`Turno #${data.shift.id}`} subtitle={data.shift.status === "cerrado" ? "Turno cerrado" : "Turno abierto"}
        actions={<>
          <Link href={can("turnos.ver_todos") ? "/turnos" : "/vender"}><Button variant="secondary"><ArrowLeft className="size-4" />Volver</Button></Link>
          {can("caja.gestionar") && "expected" in data && <Button variant={data.shift.opening_pending ? "primary" : "secondary"} onClick={() => setEdit(true)}><Wallet className="size-4" />{data.shift.opening_pending ? "Cargar caja inicial" : "Corregir caja inicial"}</Button>}
          <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button>
          <Button onClick={share}><Share2 className="size-4" />WhatsApp</Button>
        </>} />
      <ShiftReport s={data} />
      <OpeningModal shift={edit ? data.shift : null} onClose={() => setEdit(false)} onDone={() => mutate()} />
    </div>
  );
}
