// node tests/calc.test.js
import * as C from '../js/calc.js';

let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fallos++; };
const entre = (x, a, b) => x >= a && x <= b;

// ---------- Caso 1: hombre 35 a, 175 cm, 80 kg, 18 %, fuerza 4 d/sem, perder grasa 0,75 %/sem ----------
console.log('\nCaso 1 — hombre 35 a, 175 cm, 80 kg, 18 % grasa, fuerza 4 d, perder grasa');
const p1 = { sexo: 'hombre', edad: 35, altura: 175, peso: 80, grasaPct: 18, actividad: 'moderado', entreno: 'fuerza', frecuencia: 4, objetivo: 'perder', ritmo: 0.0075, reparto: 'equilibrado' };
const plan1 = C.plan(p1, []);
const mlg = 80 * 0.82; // 65.6
const tmbEsperada = Math.round(370 + 21.6 * mlg); // 1787
ok(plan1.tdee.tmb === tmbEsperada, `TMB Katch-McArdle = ${plan1.tdee.tmb} (esperado ${tmbEsperada})`);
ok(plan1.tdee.valor === Math.round(tmbEsperada * 1.55), `TDEE fórmula = ${plan1.tdee.valor} (TMB × 1,55)`);
const deficitDia = Math.round((0.0075 * 80 * 7700) / 7); // 660
ok(plan1.objetivo.kcal === plan1.tdee.valor - deficitDia, `Objetivo = ${plan1.objetivo.kcal} kcal (TDEE − ${deficitDia})`);
ok(plan1.objetivo.deficitPct <= 25, `Déficit ${plan1.objetivo.deficitPct} % ≤ 25 %`);
const m1 = plan1.macros;
ok(m1.proteina.min === Math.round(2.3 * mlg) && m1.proteina.max === Math.round(3.1 * mlg), `Proteína ${m1.proteina.min}–${m1.proteina.max} g (2,3–3,1 g/kg MLG)`);
ok(m1.grasa.min >= 40 && m1.grasa.max <= Math.round(plan1.objetivo.kcal * 0.3 / 9) + 1, `Grasa ${m1.grasa.min}–${m1.grasa.max} g (25–30 %, suelo 40 g)`);
ok(m1.hidratos.central > 0, `Hidratos ${m1.hidratos.min}–${m1.hidratos.max} g (central ${m1.hidratos.central})`);
const sumaKcal = m1.proteina.central * 4 + m1.grasa.central * 9 + m1.hidratos.central * 4;
ok(Math.abs(sumaKcal - plan1.objetivo.kcal) <= 20, `Kcal de macros centrales = ${sumaKcal} vs objetivo ${plan1.objetivo.kcal} (±20)`);
ok(m1.fibra.g === Math.round(plan1.objetivo.kcal / 1000 * 14), `Fibra ${m1.fibra.g} g`);

// ---------- Caso 2: mujer 55 kg, perder 1,5 kg/semana ----------
console.log('\nCaso 2 — mujer 55 kg, 1,5 kg/semana → debe bloquearse');
const p2 = { sexo: 'mujer', edad: 30, altura: 162, peso: 55, actividad: 'ligero', entreno: 'fuerza', frecuencia: 3, objetivo: 'perder', ritmo: 1.5 / 55, reparto: 'equilibrado' };
const plan2 = C.plan(p2, []);
ok(plan2.bloqueado === true, 'Plan bloqueado');
ok(/1 %/.test(plan2.motivo), `Motivo menciona el límite del 1 %: "${plan2.motivo.slice(0, 80)}…"`);
ok(plan2.alternativa && plan2.alternativa.kgSemana <= 0.55, `Alternativa propuesta: ${plan2.alternativa?.kgSemana} kg/semana`);

// Caso 2b: ritmo permitido pero por debajo del suelo (mujer pequeña, sedentaria, 1 %/sem)
console.log('\nCaso 2b — mujer 48 kg sedentaria, 1 %/sem → suelo calórico');
const p2b = { ...p2, peso: 48, actividad: 'sedentario', ritmo: 0.01 };
const plan2b = C.plan(p2b, []);
ok(plan2b.bloqueado === true, `Bloqueado por suelo: "${plan2b.motivo.slice(0, 90)}…"`);
ok(plan2b.alternativa && plan2b.alternativa.ritmo < 0.01, `Propone ritmo más lento: ${(plan2b.alternativa?.ritmo * 100).toFixed(2)} %/sem`);

// Caso 2c: IMC objetivo < 18,5
const plan2c = C.plan({ ...p2, ritmo: 0.005, pesoObjetivo: 47 }, []);
ok(plan2c.bloqueado && /IMC/.test(plan2c.motivo), 'IMC objetivo 17,9 → bloqueado');

// Caso 2d: menor de edad
ok(C.plan({ ...p1, edad: 17 }, []).bloqueado, 'Menor de 18 → bloqueado');

// ---------- Caso 3: motor adaptativo con 3 semanas simuladas ----------
console.log('\nCaso 3 — adaptativo, 21 días, TDEE real 2500, ingesta 2000');
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };
const registros = [];
const pendienteDia = -(2500 - 2000) / 7700; // kg/día
let pesoReal = 80;
for (let d = 0; d < 21; d++) {
  const fecha = new Date(2026, 8, 1 + d).toISOString().slice(0, 10);
  registros.push({ fecha, peso: Math.round((pesoReal + rnd() * 1.6) * 10) / 10, kcal: 2000 + Math.round(rnd() * 200) });
  pesoReal += pendienteDia;
}
const adapt = C.tdeeAdaptativo(registros);
ok(adapt !== null, `Con 21 días hay estimación medida (${adapt?.dias} días)`);
ok(adapt && entre(adapt.valor, 2350, 2650), `TDEE medido = ${adapt?.valor} (real 2500, ±150)`);
ok(C.tdeeAdaptativo(registros.slice(0, 10)) === null, 'Con 10 días no hay estimación (mínimo 14)');
const hist = C.historialTdee(registros);
ok(hist.length === 2, `Historial semanal tiene ${hist.length} entradas (días 14 y 21)`);
const tend = C.tendenciaPeso(registros);
const ruidoBruto = Math.max(...registros.map((r) => r.peso)) - Math.min(...registros.map((r) => r.peso));
const ruidoTend = Math.max(...tend.map((r) => r.tendencia)) - Math.min(...tend.map((r) => r.tendencia));
ok(ruidoTend < ruidoBruto, `La EMA suaviza: rango bruto ${ruidoBruto.toFixed(2)} kg vs tendencia ${ruidoTend.toFixed(2)} kg`);
const t3 = C.tdeeActual(p1, registros);
ok(t3.metodo === 'medido', `tdeeActual usa el método "${t3.metodo}" cuando hay datos`);
ok(C.semanasEnDeficit(registros, 2500) === 3, `Semanas en déficit = ${C.semanasEnDeficit(registros, 2500)}`);

// ---------- Caso 4: totales y reescalado de receta ----------
console.log('\nCaso 4 — receta pollo y arroz: totales y reescalado');
const receta = {
  nombre: 'Pollo con arroz', raciones: 1,
  ingredientes: [
    { nombre: 'Pechuga de pollo', gramos: 150, por100: { kcal: 110, proteina: 23, hidratos: 0, grasa: 1.5 } },
    { nombre: 'Arroz (crudo)', gramos: 70, por100: { kcal: 350, proteina: 7, hidratos: 78, grasa: 0.6 } },
    { nombre: 'Calabacín', gramos: 150, por100: { kcal: 17, proteina: 1.2, hidratos: 3, grasa: 0.2 } },
    { nombre: 'Aceite de oliva', gramos: 10, por100: { kcal: 884, proteina: 0, hidratos: 0, grasa: 100 } },
  ],
};
const tot = C.totalesReceta(receta);
const manual = { kcal: 110 * 1.5 + 350 * 0.7 + 17 * 1.5 + 88.4, proteina: 23 * 1.5 + 7 * 0.7 + 1.2 * 1.5, hidratos: 78 * 0.7 + 4.5 };
ok(tot.total.kcal === Math.round(manual.kcal), `kcal totales ${tot.total.kcal} = suma manual ${Math.round(manual.kcal)}`);
ok(tot.total.proteina === Math.round(manual.proteina), `proteína ${tot.total.proteina} g = ${Math.round(manual.proteina)}`);
ok(tot.total.hidratos === Math.round(manual.hidratos), `hidratos ${tot.total.hidratos} g = ${Math.round(manual.hidratos)}`);
const hueco = { proteina: 55, hidratos: 90, grasa: 20 };
const re = C.reescalarReceta(receta, hueco);
const pollo = re.ingredientes[0].gramos, arroz = re.ingredientes[1].gramos;
ok(pollo % 5 === 0 && arroz % 5 === 0, `Cantidades múltiplos de 5: pollo ${pollo} g, arroz ${arroz} g`);
ok(pollo !== 150 && arroz !== 70, `Reescalado por separado: pollo 150→${pollo}, arroz 70→${arroz}`);
ok(Math.abs(re.totales.total.proteina - 55) <= 5, `Proteína tras reescalar ${re.totales.total.proteina} g ≈ 55`);
ok(Math.abs(re.totales.total.hidratos - 90) <= 6, `Hidratos tras reescalar ${re.totales.total.hidratos} g ≈ 90`);
const re2 = C.reescalarReceta(receta, { proteina: 5, hidratos: 5 });
ok(re2.ingredientes[0].gramos >= 80 && re2.ingredientes[1].gramos >= 40, `Mínimos de cocina respetados con hueco ínfimo: ${re2.ingredientes[0].gramos} g / ${re2.ingredientes[1].gramos} g`);

// ---------- Navy ----------
console.log('\nNavy');
const nv = C.navy({ sexo: 'hombre', altura: 175, cuello: 38, cintura: 85 });
ok(nv && entre(nv.pct, 14, 20), `Hombre 175/38/85 → ${nv?.pct} % (rango plausible 14–20)`);

console.log(fallos ? `\n${fallos} prueba(s) fallida(s)` : '\nTodas las pruebas pasan');
process.exit(fallos ? 1 : 0);
