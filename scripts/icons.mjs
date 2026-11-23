// Genera los íconos de la PWA y las variantes de logo a partir de los originales.
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";

const HD = "public/brand/logo-hotdog369.png";
const JMM = "scripts/jmm-source.jpg";
mkdirSync("public/icons", { recursive: true });

for (const size of [192, 512]) {
  await sharp(HD).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
// Maskable: logo con margen sobre fondo negro de la marca
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#151A1D" } })
  .composite([{ input: await sharp(HD).resize(400, 400).png().toBuffer(), gravity: "center" }])
  .png().toFile("public/icons/maskable-512.png");
await sharp({ create: { width: 180, height: 180, channels: 4, background: "#151A1D" } })
  .composite([{ input: await sharp(HD).resize(160, 160).png().toBuffer(), gravity: "center" }])
  .png().toFile("public/icons/apple-touch-icon.png");
await sharp(HD).resize(48, 48).png().toFile("public/favicon.png");

// Logo JMM: solo la marca (sin datos de contacto). Los recortes ya están en public/brand.
if (existsSync(JMM)) {
await sharp(JMM).extract({ left: 190, top: 285, width: 700, height: 385 }).png().toFile("public/brand/jmm-logo.png");
await sharp(JMM).extract({ left: 360, top: 275, width: 360, height: 230 }).png().toFile("public/brand/jmm-mark.png");
}
console.log("Íconos generados");
