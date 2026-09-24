# Presupuesto — instrucciones de implementación

> **Destinatario:** Claude Code, trabajando en el repo `rudypalacios/budget-app`.
> **Objetivo:** hacer un *re-skin con cambios de comportamiento* de la pantalla
> Presupuesto (`src/app/(tabs)/budget.tsx`) para que quede como el prototipo aprobado.
> **Referencia visual y de comportamiento (fuente de verdad):**
> [`../prototypes/presupuesto-v9.html`](../prototypes/presupuesto-v9.html)
> (ábrelo en un navegador; es interactivo: toca tarjetas, abre la ⓘ y "Fijar presupuesto").
> El HTML **no se porta**: define jerarquía, orden, estados, textos y comportamiento. La
> implementación usa los componentes y tokens de la app.
>
> Verificado contra `develop` en el commit `bf8d1d0`. Si `develop` avanzó, vuelve a
> comprobar los datos de la §3 antes de codificar.
>
> **Revisión 2:** incorpora las decisiones del propietario (ver §12): la hoja inferior
> (`ActionSheet`) se crea ahora, el toast con acciones va como fase obligatoria y un
> presupuesto de 0 se trata como vacío.

---

## 0. Reglas de trabajo (obligatorias)

0. **Ubicación de estos archivos:** `.claude/design/pages/01-presupuesto.md` y
   `.claude/design/prototypes/presupuesto-v9.html`.
1. **Lee primero:** este documento completo, `CLAUDE.md` (secciones *Working process*,
   *Stage Closeout Checklist*, *Code style*, *Git conventions*) y el prototipo.
2. **Una fase a la vez.** Cada fase de la §7 es una rama y un PR independientes.
3. **Ramas:** cada fase se crea **desde `develop` actualizado**:
   ```
   git fetch origin && git checkout develop && git pull --ff-only
   git checkout -b <rama-de-la-fase>
   ```
   Si la fase anterior **no está fusionada** en `develop`, **detente y pregunta**; no
   encadenes ramas sin autorización.
4. **Plan antes del código:** al iniciar cada fase, escribe un plan corto (archivos que
   vas a tocar, pruebas que vas a escribir, dudas) y **espera aprobación**.
5. **No inventes.** Si algo no está en este documento ni en el prototipo, **pregunta**.
   Si un dato de la §3 no coincide con lo que ves en el repo, **avísalo** antes de seguir.
6. **Sin dependencias nuevas, sin cambios de esquema, sin tocar `firestore.rules`.** Esta
   página no las necesita. Si crees que las necesitas, detente y pregunta.
7. **Sin merge automático.** Al terminar una fase: commit en su rama, deja el árbol limpio
   y reporta rama + hash (plantilla en la §10).
8. Commits: `feat(budget): … (Presupuesto redesign, fase N)`.
9. Estilo del repo: TypeScript estricto sin `any`; lógica en `src/lib` con pruebas
   unitarias junto al archivo (`*.test.ts`); componentes pequeños; **comentar el porqué**;
   colores y espaciados solo desde `Colors`/`Spacing`/`useTheme` (nada de valores
   hardcodeados que existan como token).
10. Textos: todo string visible sale de `src/localization/es.json` y `en.json`
    (mismas claves en ambos). Plurales con el convenio existente `_one` / `_other` + `count`.
11. **El prototipo es solo el cuerpo de la página.** Está dibujado a ~400 px, sin menú ni
    barra de pestañas, y su contenedor (`.app{max-width:480px}`) es solo el marco de la
    maqueta. El rediseño cambia **únicamente lo que va dentro** de `ScreenScroll` /
    `ScreenHeader` en `budget.tsx`. **No se toca:** la navegación (`src/components/app-tabs.tsx`,
    `app-tabs.web.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`), los contenedores
    de pantalla (`screen-scroll.tsx`, `screen-header.tsx`), ni las constantes de layout de
    `src/constants/theme.ts` (`MaxContentWidth`, `NavBreakpoint`, `TopBarInset`,
    `BottomTabInset`, `FormRowBreakpoint`). El ancho, los márgenes y los insets de la página
    siguen siendo los que ya define la app en web y móvil. Únicas excepciones previstas: el
    `maxWidth: 480` de la hoja `ActionSheet` (fase 2, limita la hoja, no la página) y el
    toast global de la fase 7 (ya montado en `_layout.tsx`; solo cambia el componente del
    toast, no su montaje ni su posición). Si una fase parece necesitar tocar algo de esta
    lista, **detente y pregunta**. En cada PR, confirma en el reporte que el diff no toca
    estos archivos.

---

## 1. Alcance

**Dentro:** `src/app/(tabs)/budget.tsx`, `src/components/category-budget-card.tsx`,
`src/components/ui/progress-bar.tsx`, `src/components/budget-recommendation-badge.tsx`,
`src/components/ui/section-header.tsx` (prop opcional de texto derecho),
`src/components/ui/action-sheet.tsx` (**nuevo**, hoja inferior compartida),
`src/components/ui/toast.tsx` + `src/store/toast.ts` (acciones y duración),
`src/store/recurring-expenses.ts` (solo la reversión de la recomendación),
`src/app/categories/new.tsx` y `src/app/categories/[id]/edit.tsx` (**solo** normalizar un
presupuesto de 0 a vacío), un helper de lógica nuevo en `src/lib/`, textos de
`es.json`/`en.json` y documentación.

**Fuera (no tocar):** el motor de recomendaciones (`src/lib/budget-recommendation.ts`,
umbrales, cálculo del promedio), las fórmulas del resumen, el formulario de categorías,
Ajustes, Panel, Gastos, Ingresos, Historial, modelo de datos, reglas de Firestore.

**Regla de producto ya decidida:** Presupuesto **muestra y avisa**. La meta mensual de
una categoría **solo se puede fijar aquí cuando no tiene** (botón "Fijar presupuesto");
**cambiarla o quitarla después se hace en Ajustes → Categorías**. Presupuesto **no** ofrece
"Editar presupuesto" ni "Quitar presupuesto" en ninguna categoría.

---

## 2. Qué se ve al final (resumen del diseño)

Pantalla, de arriba a abajo:

1. **Título** "Presupuesto" (`ScreenHeader`, ya existe).
2. **Tarjeta de resumen** (una `Card`):
   - Rótulo pequeño **"Este mes"** con un botón **ⓘ** a la derecha.
   - Fila de 3 cifras: **Recibido · Pagado · Saldo actual** (la tercera es el resultado, un
     escalón más grande).
   - ~~Rótulo pequeño **"Lo que falta"**.~~ *(retirado, D6: la fila 2 va tras el divisor, sin rótulo)*
   - Fila de 3 cifras: **Falta pagar · Falta recibir · Saldo proyectado** (la tercera es
     el resultado).
   - Pie: **Balance general** con su cifra.
3. **Encabezado "Categorías"** con, a la derecha, "N requieren atención" (vacío si 0).
4. **Tarjetas de categorías con presupuesto**, ordenadas por urgencia. Cada una, cerrada,
   es una cara compacta: nombre (+ chip solo si excede o podría excederse), a la derecha lo
   gastado y "de {presupuesto}", chevron al extremo derecho, y una barra fina debajo.
   Al tocar la tarjeta se expande el detalle.
5. Fila plegable **"Sin presupuesto · N"** (cerrada por defecto) que, al abrirse, lista las
   categorías sin presupuesto con la misma cara (sin barra).

Colores de barra (y solo 2 chips): ver §5.3.

---

## 3. Estado actual verificado en `develop` (`bf8d1d0`)

| Archivo | Qué hace hoy | Relevancia |
|---|---|---|
| `src/app/(tabs)/budget.tsx` (250 líneas) | Calcula: `actualForCategory` (gasto **pagado** en el ciclo por `paidDate`, `lifecycleState==='active'`), `totalActual`, `totalIncomeReceived`, `netCashPosition`, `allTimeBalance`, `stillToPayThisMonth` (no pagado, no omitido, activo, `date` dentro del ciclo), `pendingIncomeThisMonth`, `projectedEndOfMonthBalance = net + pendingIncome − stillToPay`. Renderiza una `Card` con **cuadrícula 2×3 + pie** (`gridRow`, `cell`, `Divider` vertical/horizontal, `footerRow`) y luego `CategoryBudgetCard` por cada `categoriesWithActivity` (= categorías de gasto activas con `monthlyBudget != null` **o** gasto real > 0). | El resumen **ya tiene la estructura correcta**; falta el estilo, los rótulos de fila, el ⓘ y los nombres. La lista de categorías no se ordena ni separa. |
| `src/components/category-budget-card.tsx` (164 líneas) | `Card` con cabecera `Pressable` (nombre + chip "Sobre presupuesto" si `actual > budgeted`, chevron **solo si hay recurrentes**, `disabled={!hasBreakdown}`), `ProgressBar`, pie con "gastado / de presupuesto" o "sin presupuesto". Al expandir: lista de recurrentes con "Presupuestado X" + "Promedio 6 meses X" y, debajo de cada uno, `BudgetRecommendationBadge`. Chevron: `SymbolView` `chevron.right` rotado `90deg` (cerrada → apunta abajo) / `-90deg` (abierta → apunta arriba), tamaño 14, `weight="bold"`, `tintColor={theme.textSecondary}`. | Es la pieza principal a rehacer. **Conserva el chevron tal cual.** |
| `src/components/ui/progress-bar.tsx` | Props `{budgeted, actual, style}`. Color: `danger` si `ratio>1`, `warning` si `ratio>=0.8` (`WARNING_RATIO`), `success` si menos. Único consumidor: `category-budget-card.tsx`. | Se reescribe la lógica de color (§5.3); se puede cambiar su API porque tiene un solo consumidor. |
| `src/components/budget-recommendation-badge.tsx` | Compartido entre Gastos (`recurring-definition-row-item.tsx`) y este detalle. Muestra `Chip tone="warning"` con "Promedio 6 meses {average} vs presupuestado {budgeted}" y dos `Button variant="ghost"`: aceptar / descartar. Solo se pinta si `status==='pending'` y `suggestedBudgetedAmount !== null`. Al aceptar/descartar llama a `acceptBudgetRecommendation` / `dismissBudgetRecommendation` y `showToast(...)`. | Ya es "el mismo renglón que en Gastos". Se conserva su aspecto; cambia lo que ocurre después (fase 7). |
| `src/store/recurring-expenses.ts` | `acceptBudgetRecommendation(id)`: `amount = suggested / exchangeRateToDefault` y `status:'accepted'`. `dismissBudgetRecommendation(id)`: `status:'dismissed'`, `dismissedAt`, `dismissedAtAverageAmount`. **No hay deshacer.** | Base de la fase 7. |
| `src/store/toast.ts` + `src/components/ui/toast.tsx` | `showToast(message: string)`; un solo mensaje, 2500 ms, **sin botón de acción** (decisión documentada en `CLAUDE.md`, etapa 12). | La fase 7 lo amplía sin romper llamadas existentes. |
| `src/store/categories.ts` | `updateCategory(id, patch)` con `patch: Partial<Pick<Category,'name'|'type'|'color'|'icon'|'order'|'lifecycleState'|'monthlyBudget'>>`. | Se usa para "Fijar presupuesto". |
| `src/lib/budget-recommendation.ts` | `suggestCategoryMonthlyBudget(categoryId, activeRecurringExpenses, defaultCurrency)` (usada en `src/app/categories/[id]/edit.tsx`). Umbrales del motor (10 % y piso) viven aquí. | Se reutiliza para el sugerido. **No modificar.** |
| `src/components/ui/`: `card, chip, button (primary/secondary/ghost/danger), icon-button, dialog (isOpen,onClose,title,children), text-field, section-header (title, actionLabel?, onActionPress?), divider, collapsible` | Componentes a reutilizar. | — |
| `src/constants/theme.ts` | `Colors.{light,dark}`: `text, background, backgroundElement, backgroundSelected, textSecondary, border, tint, tintText, success, warning, danger`. `Spacing: half 2, one 4, two 8, three 16, four 24, five 32, six 64`. `MinTouchTarget = 44`. | Solo estos tokens. |
| `src/components/themed-text.tsx` | Tipos: `default (16/24, 500)`, `small (14/20, 500)`, `smallBold (14/20, 700)`, `caption (12/16, 500, textSecondary)`, `subtitle (32/44, 600)`, `title`, `link`, `linkPrimary`, `code`. | Mapeo de tamaños del prototipo. |
| `src/localization/{es,en}.json` → `budget.*` | Claves actuales: `title, overBudgetChip, spent, ofBudgeted, noBudgetSet, details, hideDetails, noHistoryYet, recurringBudgeted, recurringAverage, summary.{received,paid,settledBalance,pending,incomePending,projectedBalance,overallBalance}`. | Se actualizan y amplían en la §8. |

---

## 4. Lo que **no** debes tocar ni reinterpretar

- **Fórmulas del resumen** (ya correctas): `saldo actual = recibido − pagado`;
  `saldo proyectado = saldo actual + falta recibir − falta pagar`;
  `balance general = Σ recibido histórico − Σ pagado histórico` (sin saldo inicial).
- **"Falta pagar" de esta pantalla es solo lo que vence en el ciclo actual.** El Panel usa
  otra definición (todo lo pendiente, incluidos vencidos de meses anteriores). Es
  intencional; la hoja ⓘ lo explica. No unifiques.
- **Motor de recomendaciones:** el aviso solo aparece cuando el motor lo marca `pending`
  (diferencia por encima de sus umbrales) y no se vuelve a mostrar tras "Mantener actual"
  hasta que el promedio se aleje más. No agregues lógica propia de umbrales.
- **`Category.monthlyBudget`** está en la moneda por defecto. No lo conviertas.

---

## 5. Reglas de negocio de esta pantalla (RN-PRE)

Definiciones: `actual` = gasto pagado de la categoría en el ciclo (ya existe);
`pending` = gasto **pendiente** de la categoría en el ciclo (nuevo, §5.1);
`budgeted` = `normalizeMonthlyBudget(category.monthlyBudget)`, donde
`normalizeMonthlyBudget(v) = (typeof v === 'number' && Number.isFinite(v) && v > 0) ? v : null`.
**Un presupuesto de 0 (o vacío, o no numérico) equivale a "sin presupuesto"**: se comporta
exactamente igual que `null`/en blanco, que es lo que la app ya soporta.

### 5.1 Pendiente por categoría (nuevo)

`pending(categoryId)` = suma de `amountInDefaultCurrency` de los gastos con
`categoryId`, `!paid`, `!(kind==='recurringInstance' && skipped)`,
`lifecycleState==='active'` y `date` dentro del ciclo. **Es exactamente el mismo filtro**
de `stillToPayThisMonth`, por categoría. Extrae el predicado a una función compartida
(`isPendingInCycle`) y haz que `stillToPayThisMonth` la use también, sin cambiar su
resultado (lo prueban los tests de la fase 1).

### 5.2 Estado de una categoría con presupuesto

```ts
type BudgetStatus = 'none' | 'over' | 'mayExceed' | 'exact' | 'ok';
// budgeted === null (ya normalizado: incluye 0)     → 'none'
// actual > budgeted                                  → 'over'
// pending > 0 && actual + pending > budgeted         → 'mayExceed'
// redondeo a centavos: actual === budgeted            → 'exact'
// cualquier otro caso                                 → 'ok'
```

El **orden de evaluación es ese** (por eso "justo en 100 % pero con pendiente" es
`mayExceed`, no `exact`). Comparar `exact` con `Math.round(x*100)`.
`percent = budgeted > 0 ? Math.round(actual / budgeted * 100) : 0`.
`projected = actual + pending`; `projectedPercent = Math.round(projected / budgeted * 100)`.

> Se elimina el estado "cerca del límite (≥ 80 %)" que hoy usa `ProgressBar`
> (`WARNING_RATIO`). El riesgo real lo cubre `mayExceed`. Actualiza el comentario del
> archivo que menciona "FR-6 visual alert thresholds".

### 5.3 Colores de barra y chips

| Estado | Barra | Chip | Significado |
|---|---|---|---|
| `over` | `theme.danger` | `Chip tone="danger"` "Sobre presupuesto" | Se pasó |
| `mayExceed` | `theme.warning` | `Chip tone="warning"` "Podría excederse" | Con lo pendiente se pasaría |
| `exact` | `theme.success` | ninguno | Justo en el presupuesto |
| `ok` | `theme.tint` | ninguno | Dentro del presupuesto |
| `none` | (sin barra) | ninguno | Sin presupuesto |

Solo hay **dos chips**. El color **nunca** es la única señal: el `accessibilityLabel`
de la tarjeta dice el estado (§9).

### 5.4 Orden y secciones

- **Con presupuesto** (`status !== 'none'`) en una lista; **sin presupuesto** en la
  sección plegable aparte. `categoriesWithActivity` (criterio de qué categorías se
  muestran) **no cambia**.
- **Orden de "con presupuesto":** por rango `over` (0) → `mayExceed` (1) → `exact`/`ok` (2).
  Dentro de `over`: mayor exceso (`actual − budgeted`) primero. Dentro de los demás rangos:
  mayor **ratio sin redondear** (`actual / budgeted`) primero. **Desempate final: nombre**
  con `localeCompare` (determinista). *(El prototipo ordena con el porcentaje ya redondeado y
  deja los empates en el orden original; esta regla es la autoritativa.)*
- **Orden de "sin presupuesto":** mayor `actual` primero; desempate por nombre.
- **Atención** = número de categorías `over` + `mayExceed`. Encabezado derecho:
  `budget.attention` con `count` ("1 requiere atención" / "N requieren atención"); si es 0,
  no se muestra nada.

### 5.5 Expansión

- **Toda** tarjeta se puede expandir (ya no `disabled={!hasBreakdown}`). Varias pueden estar
  abiertas a la vez; el estado vive en cada tarjeta (`useState(false)`).
- La fila "Sin presupuesto · N" tiene su propio estado (`useState(false)`) y **solo existe
  si hay al menos una categoría sin presupuesto**. Al fijar el presupuesto de la última,
  desaparece sola.
- Tocar la **cara completa** de la tarjeta (nombre, montos, barra, chevron) expande; no hay
  botón "Detalles" ni ⋮.

### 5.6 Detalle expandido (contenido, en este orden)

1. **Línea de estado** (caption):
   - `none`: `budget.detail.noBudget`.
   - `over`: `budget.detail.over` (monto excedido en color `danger`).
   - `exact`: `budget.detail.exact` (color `success`).
   - `ok` / `mayExceed`: `budget.detail.remaining`.
2. **Línea de proyección** (caption, solo si hay presupuesto **y** `pending > 0`):
   `budget.detail.projection`; color `warning` si `projected > budgeted`, si no
   `textSecondary`.
3. **Recurrentes** (solo si hay): rótulo `budget.detail.recurring` y una fila por definición
   activa de la categoría: nombre a la izquierda; a la derecha **solo el monto**
   (`definition.amount * definition.exchangeRateToDefault` con `formatCurrency` en la moneda
   por defecto; **sin** la palabra "Presupuestado"). Debajo del nombre, en caption:
   - Si la definición tiene recomendación **pendiente** (mismo criterio que
     `BudgetRecommendationBadge`): **no** se muestra la línea de promedio; en su lugar,
     `BudgetRecommendationBadge` debajo de la fila (el aviso ya trae el promedio).
   - Si no: `budget.recurringAverage` o, si `rollingAverageAmount === null`,
     `budget.noHistoryYet`.
   Al final: `budget.detail.editInExpenses` (caption). **Sin enlaces ni botones.**
   Si **no** hay recurrentes: `budget.detail.noRecurring`.
4. **Solo si `status === 'none'`**: un único `Button variant="secondary"`
   "Fijar presupuesto" (fase 6). Con presupuesto no hay ningún botón de la categoría.

---

## 6. Datos y persistencia

**Sin cambios de modelo.** Todo es derivado de stores existentes. La única escritura nueva
es `updateCategory(id, { monthlyBudget })` (fase 6) y, en la fase 7, la reversión de una
recomendación aceptada/descartada.

---

## 7. Fases

Cada fase: **rama nueva desde `develop`**, plan → aprobación → implementación → pruebas →
reporte. Todas pasan `npx tsc --noEmit`, `npm run lint` y `npm test` sin regresiones.

### Fase 1 — Lógica pura + pruebas
**Rama:** `feat/budget-redesign-1-logic`

Crear `src/lib/budget-status.ts` (+ `budget-status.test.ts`) con funciones **puras**:

- `isPendingInCycle(expense, cycleRange): boolean` (predicado de §5.1).
- `pendingByCategory(expenses, cycleRange): Map<string, number>`.
- `actualByCategory(expenses, cycleRange): Map<string, number>` (mismo criterio que
  `actualForCategory` actual).
- `getBudgetStatus({ budgeted, actual, pending }): BudgetStatus` (§5.2).
- `budgetPercent(budgeted, actual)`, `projectedTotal(actual, pending)`.
- `sortCategoryRows(rows)` y `splitByBudget(rows)` (§5.4), con `rows` de la forma
  `{ id, name, budgeted, actual, pending, status }`.
- `attentionCount(rows)`.
- `normalizeMonthlyBudget(value)` (definición en §5.2).
- (Recomendado) `computeBudgetSummary(...)` que devuelve
  `{ received, paid, settled, stillToPay, incomePending, projected, overall }` con las
  **mismas fórmulas actuales**, para poder probarlas.

Cambios en `budget.tsx` en esta fase: **solo** reemplazar los cálculos inline por estas
funciones **sin cambiar lo que se ve**. La pantalla debe verse idéntica a `develop`
(salvo que una categoría con `monthlyBudget = 0` en Firestore ahora se trata como sin
presupuesto).

**Normalizar el cero al escribir** (cambio mínimo, fuera de Presupuesto pero necesario para
que la regla sea coherente): en `src/app/categories/new.tsx` y
`src/app/categories/[id]/edit.tsx`, hoy `handleSubmit` guarda
`monthlyBudget: values.monthlyBudget === '' ? null : parseAmountInput(values.monthlyBudget)`.
Cámbialo a `normalizeMonthlyBudget(...)` para que teclear `0`, un texto no numérico o dejarlo
vacío guarde `null`. No cambies nada más de esos formularios.

**Pruebas obligatorias** (dataset del prototipo, §11): `normalizeMonthlyBudget`
(`null`, `undefined`, `0`, `-5`, `NaN`, `'x'`, `3000`), estados de las 9 categorías,
orden esperado, `attentionCount = 2`, resumen numérico, `stillToPayThisMonth` idéntico
antes/después del refactor, casos borde (`budgeted` null o 0, `actual = budgeted` sin/con
pendiente, `pending = 0`, tie-breaks por nombre, omitidos/archivados excluidos).

### Fase 2 — `ActionSheet` (hoja inferior compartida)
**Rama:** `feat/budget-redesign-2-action-sheet`

**Por qué ahora:** esta página es su primer uso (la ayuda ⓘ y "Fijar presupuesto"), y Panel,
Gastos e Ingresos la usarán para menús, pago y formularios. Se construye **una vez, genérica**,
aquí. No añade dependencias: usa `Modal`, `KeyboardAvoidingView`, `ScrollView` de React Native
y `react-native-safe-area-context` (ya está en `package.json`; **verifica** que el proveedor
de áreas seguras esté montado antes de usar `useSafeAreaInsets`).

**Archivo nuevo:** `src/components/ui/action-sheet.tsx`

```ts
export type ActionSheetProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
}>;
```

**Comportamiento y aspecto** (misma técnica que `Dialog`: `Modal` transparente + `Pressable`
de fondo; tokens de `useTheme`/`Spacing`):

- Anclada **abajo**, ancho completo con `maxWidth: 480` y centrada horizontalmente en
  pantallas anchas. Esquinas superiores `Spacing.three` (16). Fondo `theme.backgroundElement`,
  borde superior `theme.border`, padding `Spacing.three`.
- **Asa** decorativa (barra corta centrada, `theme.border`) arriba; no interactiva.
- **Cabecera:** título (`ThemedText type="smallBold"`) a la izquierda y `IconButton` de cerrar
  a la derecha (área ≥ `MinTouchTarget`), `accessibilityLabel = t('common.closeDialog')`
  (la clave ya existe; **verifícala**).
- **Fondo (scrim):** `rgba(0,0,0,0.45)`; tocarlo cierra.
- **Contenido:** dentro de un `ScrollView` (`keyboardShouldPersistTaps="handled"`) con altura
  máxima del 88 % de `useWindowDimensions().height`; si el contenido es corto, la hoja mide
  lo que mida el contenido.
- **Teclado:** envolver el panel en `KeyboardAvoidingView` para que un `TextField` dentro de
  la hoja nunca quede tapado. **Comprueba manualmente iOS, Android y web** y reporta cualquier
  diferencia; usa la solución más simple que funcione en las tres.
- **Margen inferior seguro:** `padding` inferior = `Spacing.three` + inset inferior.
- **Cierre:** fondo, botón ✕, botón atrás de hardware (`onRequestClose`) y Escape en web
  (verifica que `Modal` de react-native-web lo dispare vía `onRequestClose`).
- **Animación:** `animationType="fade"` (como `Dialog`). Sin dependencias de animación. Si
  luego se quiere deslizar, es una mejora aparte.
- **Accesibilidad:** `accessibilityViewIsModal` (iOS); en web, rol de diálogo modal con el
  título como etiqueta si `react-native-web` lo permite; al abrir, el lector de pantalla
  debe anunciar el título y el foco entrar en la hoja; al cerrar, devolver el foco al
  disparador **en la medida en que la plataforma lo permita** (repórtalo si no).
- **No incluye** `ActionSheetItem` (fila de menú con ícono/etiqueta/descripción): se creará en
  la etapa de menús del Panel. Aquí solo se compone contenido libre como `children`.

**Verificación (sin pruebas de UI, por la regla del repo):** monta la hoja **temporalmente**
en `budget.tsx` detrás de un botón provisional para probarla (contenido corto, contenido
largo con scroll, un `TextField`, modo oscuro, cierre por las 4 vías) y **elimina ese montaje
antes del commit**. La hoja se usa "de verdad" en la fase 3.

### Fase 3 — Tarjeta de resumen
**Rama:** `feat/budget-redesign-3-summary`

En `budget.tsx` (estructura actual se conserva: `Card` + 2 `gridRow` + `footerRow`):

1. Encima de la fila 1: un renglón con `ThemedText type="caption"` = `budget.summary.thisMonth`
   y, a la derecha, `IconButton` (ⓘ) con
   `name={{ ios: 'info.circle', android: 'info', web: 'info' }}` y
   `accessibilityLabel={t('budget.summary.infoLabel')}`; el área táctil debe ser ≥
   `MinTouchTarget` (44) sin agrandar visualmente la fila (usa margen negativo o `hitSlop`).
2. ~~Encima de la fila 2: `caption` = `budget.summary.remaining`.~~ **Retirado (D6):** la fila 2
   va directamente después del divisor, sin rótulo.
3. **Etiquetas de celda** (`caption`) con **altura mínima de 2 líneas** (`minHeight: 32`) para
   que las cifras queden alineadas aunque una etiqueta se parta en dos líneas.
4. **Cifras:** columnas 1 y 2 conservan `ThemedText type="smallBold"` y sus colores actuales
   (`received` success, `paid` danger, `pending` danger si > 0 y success si 0,
   `incomePending` success). **Columna 3 de cada fila (resultado)**: un escalón más grande:
   `type="default"` con `style={{ fontWeight: '700' }}`, color por signo
   (`>= 0 ? 'success' : 'danger'`, como hoy). Las cifras no deben truncarse: permitir
   partir línea si no caben.
5. **Pie:** etiqueta `caption` a la izquierda y cifra a la derecha con
   `type="default"` `style={{ fontSize: 20, lineHeight: 28, fontWeight: '700' }}` (reemplaza
   el `subtitle` de 32 px). Color por signo como hoy.
6. **Hoja de ayuda ⓘ** con `ActionSheet` (`title = budget.info.title`): cuatro bloques
   (etiqueta `smallBold` + texto `caption`): *Saldo actual, Falta pagar, Saldo proyectado,
   Balance general* (§8), luego el subtítulo `budget.info.colors.title` y **4 filas de
   leyenda** (muestra de barra corta con el color + texto) para los 4 estados de §5.3;
   por último dos botones: `Button variant="secondary"` `budget.info.openPanel` (cierra y
   navega a la pestaña Panel — **verifica la ruta** leyendo `(tabs)/_layout.tsx` y cómo
   otras pantallas navegan al Panel; no supongas el path) y `Button variant="primary"`
   `budget.info.close`.
7. Actualiza los textos de `budget.summary.*` (§8).

No toques los cálculos. **Verificación manual:** claro/oscuro; fuente al 150 %; cifras de 6
dígitos; una etiqueta larga en inglés.

### Fase 4 — Cara compacta de la categoría, estados, orden y sección plegable
**Rama:** `feat/budget-redesign-4-cards`

1. **`ProgressBar`** → recibe `status: 'over'|'mayExceed'|'exact'|'ok'` (o un `color`) y
   `ratio`/`budgeted`+`actual` para el ancho (`min(actual/budgeted, 1)`). Colores de §5.3.
   Elimina `WARNING_RATIO`. Mantén `accessibilityRole="progressbar"` y `accessibilityValue`
   **pero** dentro de la tarjeta ocúltala del árbol de accesibilidad (la etiqueta de la
   `Pressable` ya lo dice todo; evita lectura doble).
2. **`CategoryBudgetCard`** (props nuevas: `budgeted`, `actual`, `pending`, `status`,
   `defaultCurrency`, `recurringExpensesInCategory`; la lógica de estado **viene de
   `budget-status.ts`**, no se recalcula aquí):
   - Cara = `Pressable` que envuelve **todo**: fila superior con nombre (`smallBold`) y
     debajo el chip (solo `over`/`mayExceed`) a la izquierda (`flex: 1`); a la derecha una
     columna alineada a la derecha con `actual` (`smallBold`) y debajo `caption`
     `budget.ofBudgeted` ("de {monto}") o `budget.noBudgetSet`; chevron (**el mismo
     `SymbolView` de hoy**) al extremo derecho. Debajo, si hay presupuesto, `ProgressBar`.
   - `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, y el
     `accessibilityLabel` compuesto de §9.
   - Ya no `disabled={!hasBreakdown}` y el chevron se muestra **siempre**.
   - El contenido expandido se implementa en la fase 5; en esta fase muestra solo la
     línea de estado y la de proyección (§5.6 puntos 1–2).
3. **`budget.tsx`:** construir `rows`, ordenar/separar con `sortCategoryRows`/`splitByBudget`;
   `SectionHeader` (o equivalente) "Categorías" con el conteo de atención a la derecha
   (si `SectionHeader` no admite texto derecho no interactivo, extiéndelo con una prop
   opcional de solo texto en vez de improvisar); lista con presupuesto; fila plegable
   `budget.noBudgetSection` con `count` (usa `Collapsible` si encaja; si no, `Pressable` +
   el mismo chevron) y debajo las tarjetas sin presupuesto cuando está abierta.
4. **Estado vacío** (`categoriesWithActivity.length === 0`): `budget.empty` (caption).
5. **Quitar** los filtros y cualquier resumen global "Gastado X de Y presupuestados": **no
   existen** en el diseño final.

**Verificación manual:** las 9 categorías del dataset (§11) se ven en el orden esperado;
chips solo en Alimentación y Ocio; barras: rojo/ámbar/verde/azul según §5.3; chevron gira;
tocar cualquier parte de la cara expande.

### Fase 5 — Detalle expandido y aviso de recomendación
**Rama:** `feat/budget-redesign-5-detail`

Implementar §5.6 completo. Puntos finos:

- Criterio de "recomendación pendiente": extrae a `src/lib/budget-recommendation.ts` una
  función pura `isRecommendationPending(budgetRecommendation): boolean` con la misma
  condición que hoy usa `BudgetRecommendationBadge` (`status === 'pending' &&
  suggestedBudgetedAmount !== null`), y haz que **badge y detalle** la usen. **No cambies**
  la condición.
- Conserva la conversión de moneda que ya existe en el badge y en el detalle
  (`amount * exchangeRateToDefault`).
- **No** agregues botones "Editar/Quitar presupuesto" ni enlaces a Gastos/Categorías; el
  único texto de guía es `budget.detail.editInExpenses`.
- Retira las claves `budget.details`, `budget.hideDetails` y `budget.recurringBudgeted` **si
  quedan sin uso** (`grep` antes de borrar).

### Fase 6 — "Fijar presupuesto" (solo categorías sin presupuesto)
**Rama:** `feat/budget-redesign-6-set-budget`

1. En el detalle de una categoría con `status === 'none'`: `Button variant="secondary"`
   `budget.setBudget`.
2. Al pulsarlo: `ActionSheet` (`title = budget.setBudgetSheet.title`) con:
   - `TextField` (`label = budget.setBudgetSheet.field` con el símbolo de la moneda por
     defecto), teclado numérico, **foco inicial en el campo**, vacío al abrir, entrada saneada con
     `sanitizeAmountInput` y leída con `parseAmountInput` (`src/lib/currency-input.ts`).
   - **Sugerido:** si `suggestCategoryMonthlyBudget(categoryId, activeRecurringExpenses,
     defaultCurrency)` devuelve un valor (`> 0`), mostrar `budget.setBudgetSheet.suggestion`
     y un `Button variant="ghost"` `budget.setBudgetSheet.useSuggested` que rellena el
     campo. Si devuelve `null` o no hay recurrentes, no se muestra nada de sugerido.
   - Botones al pie de la hoja, en una fila y del mismo ancho (`flex: 1`, alto ≥ 44):
     `Button variant="secondary"` cancelar (`common.cancel` si existe; **verifica la clave**) y
     `Button variant="primary"` guardar (`common.save` si existe; verifica). El campo no debe
     quedar tapado por el teclado (lo resuelve `ActionSheet`, fase 2).
   - **Validación:** valor `> 0`; si no, `error` del `TextField` = `budget.setBudgetSheet.error`
     y no guarda.
3. Guardar: `await updateCategory(category.id, { monthlyBudget: valor })`, cerrar la hoja
   y `showToast(t('budget.setBudgetSheet.saved', { name, amount }))`. La categoría pasa sola
   a la lista principal porque todo se deriva del store.
4. **No** hay "Editar/Quitar" para categorías que ya tienen presupuesto.

### Fase 7 — Toast con acciones y aviso posterior a la recomendación
**Rama:** `feat/budget-redesign-7-toast-actions`

Esta fase toca un componente compartido (Gastos también verá el cambio, y es lo deseado:
Gastos usará las mismas acciones). Es **obligatoria** y va en su propia rama y PR, después de
la fase 6.

1. **`src/store/toast.ts`:** ampliar sin romper llamadas existentes:
   ```ts
   showToast(message: string, options?: {
     actions?: { label: string; onPress: () => void }[];   // 0–2
     durationMs?: number;                                   // por defecto 2500
   }): void
   ```
   Un solo aviso a la vez (uno nuevo reemplaza al anterior). Pulsar una acción ejecuta su
   `onPress` y cierra el aviso.
2. **`src/components/ui/toast.tsx`:** con acciones, el texto va en la primera línea y las
   acciones (texto, sin fondo, alto ≥ `MinTouchTarget`) alineadas a la derecha debajo; con
   dos acciones no se recortan. Sin acciones, el aspecto actual no cambia.
   `accessibilityLiveRegion="polite"` (o el equivalente que ya use).
3. **`BudgetRecommendationBadge`:**
   - **Aceptar:** capturar antes `snapshot = { amount: definition.amount,
     budgetRecommendation: definition.budgetRecommendation }`; llamar
     `acceptBudgetRecommendation`; mostrar toast (**8000 ms**) con
     `recurringExpense.recommendation.accepted` (incluye `{{amount}}` = monto aceptado en
     moneda por defecto) y dos acciones: **Deshacer** y **Editar**.
   - **Descartar:** capturar `snapshot` de `budgetRecommendation`; llamar
     `dismissBudgetRecommendation`; toast (8000 ms) con
     `recurringExpense.recommendation.dismissed` y una acción **Deshacer**.
   - **Deshacer:** restaura el snapshot con una función nueva del store
     `revertBudgetRecommendation(id, snapshot)` (usa `store.update`; `updateRecurringExpense`
     solo acepta campos editables y no incluye `budgetRecommendation`). **Guarda de
     seguridad:** antes de restaurar, comprueba que el estado actual de la definición aún
     coincide con el resultante de la acción; si cambió (p. ej. un recálculo), **no
     restaures** y no muestres error.
   - **Editar:** navega al formulario de edición de esa definición recurrente (**ubica la
     ruta real** leyendo cómo `recurring-definition-row-item.tsx` navega a editar; no
     supongas el path) y cierra el aviso.
4. El aspecto de la banda (chip warning + dos botones) **no cambia**; los textos de los dos
   botones siguen siendo `recurringExpense.recommendation.accept` / `.dismiss`.

### Fase 8 — Cierre
**Rama:** `chore/budget-redesign-8-closeout`

- `docs/SRS-presupuesto-app.md`: añadir un FR breve para la pantalla Presupuesto
  (estados de barra: rojo/ámbar/verde/azul, "podría excederse", fijar presupuesto solo si
  no existe) y mencionar que se retiró el umbral del 80 %.
- `CLAUDE.md`: actualizar "Current stage" y **Known Issues** (incluye: la definición de
  "Falta pagar" de Presupuesto vs Panel, y cualquier limitación de foco/teclado de
  `ActionSheet` que hayas reportado). Documentar `ActionSheet` y el toast con acciones como
  componentes compartidos.
- Confirmar que `.claude/design/` está en `.prettierignore` (si no, añadirlo) para que
  `npm run format:check` no evalúe estos archivos. **No** añadir archivos `*.test.js` dentro de
  `.claude/design/`: `npm test` (jest) los recogería.
- Barrido: claves i18n huérfanas, `tsc`, `lint`, `test`, accesibilidad (§9), modo oscuro.

---

## 8. Textos (`es.json` / `en.json`, mismas claves)

Sección `budget`. **Actualizar** las marcadas *(cambia)* y **añadir** las demás.

| Clave | es | en |
|---|---|---|
| `budget.summary.thisMonth` | Este mes | This month |
| ~~`budget.summary.remaining`~~ | ~~Lo que falta~~ | ~~What's left~~ *(retirada, D6)* |
| `budget.summary.received` *(cambia)* | Recibido | Received |
| `budget.summary.paid` *(cambia)* | Pagado | Paid |
| `budget.summary.settledBalance` *(cambia)* | Saldo actual | Current balance |
| `budget.summary.pending` *(cambia)* | Falta pagar | Left to pay |
| `budget.summary.incomePending` *(cambia)* | Falta recibir | Left to receive |
| `budget.summary.projectedBalance` | Saldo proyectado | Projected balance |
| `budget.summary.overallBalance` | Balance general | Overall balance |
| `budget.summary.infoLabel` | Cómo se calcula el resumen | How the summary is calculated |
| `budget.info.title` | Cómo se calcula | How it's calculated |
| `budget.info.settledBalance.title` / `.body` | Saldo actual / Lo recibido menos lo pagado este mes. | Current balance / What you received minus what you paid this month. |
| `budget.info.pending.title` / `.body` | Falta pagar / Lo que vence este mes y aún no pagas. El Panel también cuenta vencidos de meses anteriores. | Left to pay / What is due this month and not yet paid. The Dashboard also counts overdue items from earlier months. |
| `budget.info.projected.title` / `.body` | Saldo proyectado / Saldo actual, menos lo que falta pagar, más lo que falta recibir. Es lo que te quedaría a fin de mes. | Projected balance / Current balance, minus what is left to pay, plus what is left to receive. It is what you would have at month end. |
| `budget.info.overall.title` / `.body` | Balance general / Todo lo recibido menos todo lo pagado desde que usas la app. No incluye un saldo inicial, así que no es el saldo de tu cuenta. | Overall balance / Everything received minus everything paid since you started using the app. It has no starting balance, so it is not your bank balance. |
| `budget.info.colors.title` | Colores de las barras | Bar colors |
| `budget.info.colors.over` | Se pasó del presupuesto | Over budget |
| `budget.info.colors.mayExceed` | Podría pasarse con lo que falta pagar | Could go over once pending bills are paid |
| `budget.info.colors.exact` | Justo en el presupuesto | Exactly on budget |
| `budget.info.colors.ok` | Dentro del presupuesto | Within budget |
| `budget.info.openPanel` | Ver en el Panel | View in Dashboard |
| `budget.info.close` | Entendido | Got it |
| `budget.categories` | Categorías | Categories |
| `budget.attention_one` / `_other` | {{count}} requiere atención / {{count}} requieren atención | {{count}} needs attention / {{count}} need attention |
| `budget.noBudgetSection` | Sin presupuesto · {{count}} | No budget · {{count}} |
| `budget.overBudgetChip` | Sobre presupuesto *(ya existe)* | Over budget |
| `budget.mayExceedChip` | Podría excederse | Could go over |
| `budget.ofBudgeted` | de {{amount}} *(ya existe)* | of {{amount}} |
| `budget.noBudgetSet` | Sin presupuesto *(ya existe)* | No budget set |
| `budget.detail.remaining` | Te quedan {{amount}} · {{percent}} % usado | {{amount}} left · {{percent}}% used |
| `budget.detail.over` | Excedido por {{amount}} · {{percent}} % del presupuesto | Over by {{amount}} · {{percent}}% of budget |
| `budget.detail.exact` | Justo en el presupuesto · 100 % | Exactly on budget · 100% |
| `budget.detail.projection` | Con lo que falta pagar ({{pending}}) llegarías a {{projected}} · {{percent}} % | With what is left to pay ({{pending}}) you would reach {{projected}} · {{percent}}% |
| `budget.detail.noBudget` | Sin presupuesto. Fija una meta mensual para ver cuánto te queda. | No budget set. Set a monthly target to see how much is left. |
| `budget.detail.recurring` | Recurrentes | Recurring |
| `budget.detail.noRecurring` | Sin recurrentes en esta categoría: el gasto viene de pagos únicos. | No recurring items in this category: spending comes from one-time payments. |
| `budget.detail.editInExpenses` | Para cambiar un recurrente, edítalo en Gastos. | To change a recurring item, edit it in Expenses. |
| `budget.recurringAverage` | Promedio 6 meses {{amount}} *(ya existe)* | 6-month avg {{amount}} |
| `budget.noHistoryYet` | Aún sin historial de pagos *(ya existe)* | No paid history yet |
| `budget.empty` | Aún no hay gasto ni presupuestos este mes. Fija un presupuesto en una categoría para empezar. | No spending or budgets this month yet. Set a budget on a category to get started. |
| `budget.setBudget` | Fijar presupuesto | Set budget |
| `budget.setBudgetSheet.title` | Fijar presupuesto | Set budget |
| `budget.setBudgetSheet.field` | Presupuesto mensual ({{currency}}) | Monthly budget ({{currency}}) |
| `budget.setBudgetSheet.suggestion` | Según tus recurrentes de esta categoría: {{amount}}. El resto (gastos únicos) no se cuenta ahí. | Based on your recurring items in this category: {{amount}}. One-time spending is not counted there. |
| `budget.setBudgetSheet.useSuggested` | Usar sugerido | Use suggested |
| `budget.setBudgetSheet.error` | Escribe un monto mayor que 0. | Enter an amount greater than 0. |
| `budget.setBudgetSheet.saved` | Presupuesto de {{name}} fijado en {{amount}}. | Budget for {{name}} set to {{amount}}. |
| `budget.a11y.card` | {{name}}, {{percent}} % del presupuesto, gastado {{spent}} de {{budgeted}}{{status}}. {{toggle}} detalles | {{name}}, {{percent}}% of budget, spent {{spent}} of {{budgeted}}{{status}}. {{toggle}} details |
| `budget.a11y.cardNoBudget` | {{name}}, gastado {{spent}}, sin presupuesto. {{toggle}} detalles | {{name}}, spent {{spent}}, no budget. {{toggle}} details |
| `budget.a11y.statusOver` / `statusMayExceed` / `statusExact` | , sobre presupuesto / , podría excederse / , justo en el presupuesto | , over budget / , could go over / , exactly on budget |
| `budget.a11y.show` / `budget.a11y.hide` | Ver / Ocultar | Show / Hide |
| `recurringExpense.recommendation.accepted` *(cambia)* | Presupuesto de {{name}} actualizado a {{amount}} desde el próximo mes. | Budget for {{name}} updated to {{amount}} from next month. |
| `recurringExpense.recommendation.dismissed` *(cambia)* | Se mantiene el presupuesto de {{name}}. Te avisaremos si el promedio se aleja más. | Keeping the budget for {{name}}. We'll tell you if the average drifts further. |
| `recurringExpense.recommendation.undo` | Deshacer | Undo |
| `recurringExpense.recommendation.edit` | Editar | Edit |

> Las claves `budget.details`, `budget.hideDetails`, `budget.recurringBudgeted` se retiran
> solo si quedan sin uso tras la fase 5.

---

## 9. Accesibilidad (checklist)

- Tarjeta: `Pressable` con `accessibilityRole="button"`, `accessibilityState={{ expanded }}`
  y **etiqueta compuesta** (`budget.a11y.card` / `cardNoBudget`) que incluye nombre,
  porcentaje, gastado, presupuestado y **estado** (sobre presupuesto / podría excederse /
  justo). La barra y el chevron no se leen aparte.
- Fila "Sin presupuesto · N": `accessibilityState={{ expanded }}`.
- ⓘ: `accessibilityLabel` propio; la hoja (`ActionSheet`) anuncia su título al abrir y mantiene
  el foco dentro (fase 2).
- Objetivos táctiles ≥ 44: ⓘ, cara de tarjeta, "Fijar presupuesto", cerrar de la hoja, botones
  de la hoja y del toast.
- Ningún estado depende solo del color (chips/texto/etiqueta accesible).
- Escala de fuente al 150 %: nada se corta; etiquetas de celda reservan 2 líneas.
- Contraste ≥ 4,5:1 del texto `caption` sobre `Card` en claro y oscuro (los tokens ya
  existen; solo verifica).

---

## 10. Plantilla de reporte de cada fase

```
Presupuesto redesign — fase N: <nombre>
Rama: <rama> · Commit: <hash> · Árbol limpio: sí
Origen: develop @ <hash>
tsc --noEmit: <ok> · npm run lint: <ok> · npm test: <n>/<n>
Archivos tocados: <lista>
Desviaciones del plan aprobado: <lista o "ninguna">
Navegación/contenedores/layout intactos (regla 0.11): <sí, o qué se tocó y por qué>
Claves i18n añadidas/cambiadas/retiradas: <lista>
Verificación manual (claro/oscuro, 150 %, dataset §11): <checklist>
Dudas abiertas: <lista o "ninguna">
```

---

## 11. Dataset de verificación (del prototipo)

Categorías del ciclo (moneda por defecto, valores en `Q`):

| id | Nombre | budgeted | actual | pending | Estado esperado | % | Proyectado |
|---|---|---:|---:|---:|---|---:|---|
| `viv` | Vivienda | 7,500.00 | 7,077.05 | 0 | `ok` | 94 | — |
| `deu` | Deudas | 14,000.00 | 13,104.60 | 0 | `ok` | 94 | — |
| `pre` | Préstamos | 3,900.00 | 3,900.00 | 0 | `exact` | 100 | — |
| `ali` | Alimentación | 3,000.00 | 3,184.85 | 0 | `over` | 106 | — |
| `fam` | Familia | *null* | 1,500.00 | 0 | `none` | — | — |
| `ser` | Servicios | 1,200.00 | 550.00 | 335.00 | `ok` | 46 | 885.00 · 74 % |
| `oci` | Ocio | 500.00 | 420.00 | 150.00 | `mayExceed` | 84 | 570.00 · 114 % |
| `pro` | Programación | 300.00 | 0.00 | 107.85 | `ok` | 0 | 107.85 · 36 % |
| `tra` | Transporte | 800.00 | 0.00 | 0 | `ok` | 0 | — |

- **Orden esperado (con presupuesto):** Alimentación, Ocio, Préstamos, Vivienda (94,36 %),
  Deudas (93,60 %), Servicios, Programación, Transporte (estas dos con ratio 0 → por nombre).
  **Sin presupuesto:** Familia.
- `attentionCount = 2`. Chips: solo en Alimentación ("Sobre presupuesto") y Ocio
  ("Podría excederse"). Barra verde: Préstamos. Ámbar: Ocio. Roja: Alimentación. Azul: el resto.
- **Resumen** con `received = 20,974.67`, `pendingIncome = 6,755.48`,
  `allTimeIncome = 41,320.11`, `allTimeExpenses = 55,821.00` y los `actual`/`pending` de arriba:
  `paid = 29,736.50` · `settled = −8,761.83` · `stillToPay = 592.85` ·
  `projected = −2,599.20` · `overall = −14,500.89`.
- Recomendación de ejemplo: recurrente **Agua** (dentro de Servicios) presupuestado 85.00 con
  promedio 112.00 → muestra la banda; tras aceptar queda 112.00 y desaparece; tras
  "Mantener actual" desaparece sin cambiar el monto.
- Casos borde a probar: `actual === budgeted` con `pending > 0` → `mayExceed`;
  `budgeted = 0` (se trata como sin presupuesto, D1); categoría sin recurrentes; recurrente sin historial
  (`rollingAverageAmount = null`); definición en moneda extranjera (monto convertido);
  todas las categorías sin presupuesto; ninguna categoría con actividad (estado vacío).

---

## 12. Decisiones tomadas por el propietario (no reabrir)

| # | Tema | Decisión |
|---|---|---|
| D1 | Presupuesto de 0 | **No tiene sentido.** Se trata como vacío: equivale a `null`. Se normaliza al leer (`normalizeMonthlyBudget`) y al escribir en los formularios de categoría (fase 1). |
| D2 | `stillToPayThisMonth` | Sí se extrae el predicado compartido `isPendingInCycle` (ver nota abajo). |
| D3 | Toast con acciones | **Va en esta misma iniciativa, en su propia fase (7)**, obligatoria. Gastos la usará después. |
| D4 | Hoja inferior | **Se crea ahora** (`ActionSheet`, fase 2), porque esta página es su primer uso. Ya no se usa `Dialog` para la ayuda ni para "Fijar presupuesto". |
| D5 | Texto derecho del encabezado "Categorías" | El diseño lo incluye ("N requieren atención"): **se extiende `SectionHeader` con una prop opcional de texto derecho no interactivo** (p. ej. `trailingText?: string`); no se usa `actionLabel` porque implica un botón. |
| D6 | Rótulo "Lo que falta" sobre la fila 2 del resumen | **Se retira** (revisión de la fase 3): el divisor ya separa las dos filas y el espacio libre compacta la tarjeta. La clave `budget.summary.remaining` no se crea. |

**Nota sobre D2 (qué se refactoriza exactamente):** hoy `stillToPayThisMonth` es un filtro
escrito dentro de `budget.tsx` (no pagado, no omitido si es instancia recurrente, activo, con
`date` dentro del ciclo). La pantalla ahora necesita **el mismo filtro por categoría** (para
"podría excederse"). Si se copia, queda en dos sitios y pueden divergir. El refactor es
**solo mover ese filtro a una función `isPendingInCycle` en `src/lib/budget-status.ts`** y que
`stillToPayThisMonth` y `pendingByCategory` la usen. El resultado numérico no cambia; una
prueba lo demuestra. No hay más refactor.

No queda ninguna pregunta previa pendiente: empieza con el plan de la fase 1 y espera mi
aprobación.

---

## 13. No hacer

- No portar HTML/CSS del prototipo; no copiar los tamaños en px (usa tokens y tipos de texto).
- No trasladar el ancho/marco del prototipo a la página ni tocar navegación, contenedores de
  pantalla o constantes de layout (regla 0.11).
- No añadir filtros, resumen global de categorías, "Editar/Quitar presupuesto", enlaces de
  navegación en el detalle ni segundas sugerencias de presupuesto.
- No modificar el motor de recomendaciones, el modelo de datos, las reglas de Firestore ni
  otras pantallas.
- No introducir iconos nuevos fuera del sistema de símbolos que ya usa la app
  (`SymbolView`); el ⓘ y el chevron salen de ahí.
- No fusionar ramas; no dejar trabajo sin commit; no marcar una fase como terminada sin
  `tsc`, `lint` y `test` en verde.
