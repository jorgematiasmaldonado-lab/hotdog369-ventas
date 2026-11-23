import Image from "next/image";

export default function Acerca() {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
      <Image src="/brand/logo-hotdog369.png" alt="HOT DOG 369" width={160} height={160} className="mx-auto" />
      <div>
        <h1 className="font-display text-3xl uppercase">HOT DOG <span className="text-primary">369</span></h1>
        <p className="text-muted">Sistema de control de ventas · Panchería y Cafetería · v1.0</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="mb-4 text-sm text-text-2">Desarrollado por</p>
        <Image src="/brand/jmm-logo.png" alt="JMM Gestiones & Tecnología" width={320} height={176} className="mx-auto rounded-xl" />
      </div>
    </div>
  );
}
