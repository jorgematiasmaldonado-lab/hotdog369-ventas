"use client";
import useSWR from "swr";
import { use } from "react";
import Link from "next/link";
import { Printer, Share2, ArrowLeft } from "lucide-react";
import { Button, ErrorBox, Loading, PageTitle } from "@/components/ui";
import { ShiftReport, shiftWhatsappText, type ShiftSummary } from "@/components/shift-report";
import { fetcher } from "@/lib/client/fetcher";
import { useMe } from "@/components/me";

export default function TurnoDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useMe();
  const { data, error } = useSWR<ShiftSummary>(`/api/shifts/${id}`, fetcher);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(shiftWhatsappText(data))}`, "_blank");
  return (
    <div>
      <PageTitle title={`Turno #${data.shift.id}`} subtitle={data.shift.status === "cerrado" ? "Turno cerrado" : "Turno abierto"}
        actions={<>
          <Link href={can("turnos.ver_todos") ? "/turnos" : "/vender"}><Button variant="secondary"><ArrowLeft className="size-4" />Volver</Button></Link>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button>
          <Button onClick={share}><Share2 className="size-4" />WhatsApp</Button>
        </>} />
      <ShiftReport s={data} />
    </div>
  );
}
