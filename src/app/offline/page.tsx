export default function Offline() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-brand-black p-6 text-center text-white">
      <img src="/brand/logo-hotdog369.png" alt="HOT DOG 369" width={120} height={120} />
      <h1 className="font-display text-2xl">Sin conexión</h1>
      <p className="max-w-xs text-white/70">Abrí la pantalla <b>Vender</b> una vez con internet para poder usarla sin conexión. Las ventas se guardan y se envían solas al volver la señal.</p>
      <a href="/vender" className="rounded-xl bg-brand-red px-5 py-3 font-bold">Ir a Vender</a>
    </div>
  );
}
