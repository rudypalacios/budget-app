# Ajustes — instrucciones de implementación

> **Destinatario:** Claude Code, trabajando en el repo `rudypalacios/budget-app`.
> **Ubicación de estos archivos:** `.claude/design/pages/02-ajustes.md` (este documento).
> No hay un HTML de referencia para esta página: el diseño se especifica por completo
> aquí, porque el comportamiento cambió respecto a los prototipos previos tras discutirlo
> con el propietario (ver §1).
>
> Verificado contra `develop` en el commit `26fc7c9` (ya incluye el rediseño de
> Presupuesto: `ActionSheet`, `showToast` con acciones, `SectionHeader.trailingText`).
> Si `develop` avanzó, vuelve a comprobar los datos de la §3 antes de codificar.

---

## 0. Reglas de trabajo (obligatorias — idénticas a las de Presupuesto)

1. **Lee primero:** este documento completo y `CLAUDE.md` (*Working process*,
   *Stage Closeout Checklist*, *Code style*, *Git conventions*).
2. **Una fase a la vez**, cada una en su rama y su PR, creada **desde `develop`
   actualizado**. Si la fase anterior no está fusionada, detente y pregunta.
3. **Plan antes del código:** al iniciar cada fase, escribe un plan corto (archivos,
   pruebas, dudas) y espera aprobación.
4. **No inventes.** Si algo no está aquí ni en el código citado, pregunta. Si un dato de
   la §3 no coincide con lo que ves en el repo, avísalo antes de seguir.
5. **Sin dependencias nuevas**, sin cambios de esquema, sin tocar `firestore.rules`. Esta
   página no las necesita.
6. **Sin merge automático.** Reporta rama + hash (plantilla en la §10).
7. Commits: `feat(settings): … (Ajustes redesign, fase N)`.
8. Estilo del repo: TypeScript estricto sin `any`; lógica en `src/lib` con pruebas
   unitarias junto al archivo; comentar el porqué; tokens de `Colors`/`Spacing`/`useTheme`.
9. Textos: toda cadena visible sale de `es.json`/`en.json`, mismas claves en ambos,
   plurales `_one`/`_other` + `count`.

---

## 1. La decisión central de esta página (léela antes de todo lo demás)

**Se elimina el botón "Guardar" de Ajustes.** Cada control del formulario general
(moneda, idioma, tema, recordatorios, retención de la papelera) escribe **de inmediato**
al cambiar, igual que ya lo hacen Categorías y Monedas en pantallas propias.

Esto **revierte una decisión previa y documentada** (Stage 10, "Settings Save scope
decision", `CLAUDE.md` línea ~588): un único Save para todo el formulario. Se cambia a
propósito, por decisión explícita del propietario, no por descuido. Razón: ningún campo
de esta pantalla necesita revisarse antes de comprometerse (son reversibles con otro
toque) salvo la moneda predeterminada, que ya tiene — y conserva — su propia pausa de
confirmación (§4.1). La app ya es offline-first vía la caché local de Firestore
(`createDocumentStore`/`createCollectionStore`: la UI se actualiza al instante por el
propio `onSnapshot`, haya o no red), así que el guardado inmediato no es menos seguro que
categorías/monedas, que ya funcionan así.

**Consecuencia de diseño, no solo de arquitectura:** dos campos dejan de ser `TextField`
libre y pasan a controles de opciones discretas (§4.4, §4.5), precisamente para que el
guardado inmediato nunca escriba un valor a medio teclear.

Actualiza el comentario de `CLAUDE.md` en el cierre (fase 3) para que dependa de esta
nueva decisión y no de la anterior.

---

## 2. Alcance

**Dentro:** `src/app/(tabs)/settings.tsx` (reescritura sustancial), un helper nuevo en
`src/lib/` para el debounce del stepper, textos de `es.json`/`en.json`, documentación.
Cosmética menor y puntual en `src/app/categories/index.tsx`, `src/app/currencies/index.tsx`,
`src/app/recurring-groups/index.tsx`, `src/app/archive/index.tsx`, `src/app/trash/index.tsx`
(fase 2, alcance acotado en §6).

**Fuera (no tocar):** el modelo de datos, `firestore.rules`, `EmojiPicker`,
`CurrencyRateField` (incluida `fetchExchangeRate`, ya real y funcional), el motor de
`markBudgetRecommendationsStale`/`markCurrenciesStale`, `lifecycle-records.ts`,
`lifecycle-actions.ts`, `ConfirmRecordsDialog`, Panel, Gastos, Ingresos, Historial,
Presupuesto.

---

## 3. Estado actual verificado en `develop` (`26fc7c9`)

### 3.1 La pantalla raíz (lo que más cambia)

| Archivo | Qué hace hoy |
|---|---|
| `src/app/(tabs)/settings.tsx` (351 líneas) | `SettingsForm` con **estado local** (`useState`) para `currency, language, theme, remindersEnabled, leadDays, trashRetentionDays`, inicializado una vez desde `settings` cargado. Un único `handleSave` async llama `updateUserSettings(...)` con **todo el patch junto**. Secciones: Cuenta (correo o "Crear cuenta/Iniciar sesión" + Cerrar sesión), General (`Select` moneda con `SUPPORTED_CURRENCIES` completo, `Select` idioma con `LANGUAGES`, chips de tema), filas de navegación a Categorías/Monedas/Grupos (con conteo), Recordatorios (`Switch` + `TextField` condicional), Datos (`TextField` retención + filas a Archivo/Papelera), botón Guardar, botón Cerrar sesión duplicado al final. |
| `src/store/user-settings.ts` | `updateUserSettings(patch)`: `store.update(patch)` y, **solo si `defaultCurrency` cambió**, dispara en la misma llamada `markBudgetRecommendationsStale()` (bulk `budgetRecommendation.status='stale'` en todas las `recurringExpenses`) y `markCurrenciesStale()` (bulk `status='stale'` en todas las `currencies`), vía `firestoreClient.batchUpdate`. **Esta función y su side-effect de moneda no cambian.** |
| `src/store/create-document-store.ts` | `update()` hace `await firestoreClient.updateDoc(...)`; la UI ya refleja el cambio antes por el listener `onSnapshot` local (`fromCache`/`hasPendingWrites` ya expuestos en el estado). **No esperes el `Promise` para actualizar la UI**: dispáralo y sigue (mismo patrón que Categorías/Monedas). |
| `src/constants/currencies.ts` | `SUPPORTED_CURRENCIES`: **16 monedas fijas** (GTQ, USD, EUR, MXN, CAD, GBP, COP, ARS, CLP, PEN, BRL, DOP, HNL, CRC, PAB + una más — cuenta las líneas reales al codificar). No es una lista abierta; no se agregan monedas nuevas al catálogo. |
| `src/store/currencies.ts` | `addCurrency(code, rate, source)`, `updateCurrencyRate`, `removeCurrency`, `getConfiguredRate`. ID determinístico = el código. |
| **Importante:** la moneda predeterminada **no** tiene que estar en la lista de "monedas agregadas".** El `Select` actual ya ofrece las 16 de `SUPPORTED_CURRENCIES`, agregada o no, sin filtrar por `status`. Cambiar el default a una moneda nunca agregada es válido (su tasa relativa a sí misma es 1; no necesita fila en `currencies`). | |

### 3.2 Subpantallas — **ya bien construidas, no las rediseñes de cero**

Cada una es una ruta propia, ya escribe de inmediato (sin Save) y ya sigue buenas
prácticas de confirmación y accesibilidad. La fase 2 es **cosmética y puntual**, no una
reconstrucción.

| Pantalla | Archivo | Ya tiene |
|---|---|---|
| Categorías | `src/app/categories/index.tsx` + `src/components/category-form.tsx` | Lista con `Switch` activar/archivar, `Dialog` de eliminar (bloqueado si `canDeleteCategory` dice que hay registros dependientes), formulario con `EmojiPicker` (grid de 32 emoji + **vista previa en el propio botón**, ya resuelve lo que pediste sobre "ver el icono antes de elegirlo": nada que rediseñar ahí) y sugerido de presupuesto vía `suggestCategoryMonthlyBudget`. |
| Monedas | `src/app/currencies/index.tsx` + `.../new.tsx` + `.../[code]/edit.tsx` | Lista con tasa, chip "Necesita actualización" si `stale`, `OverflowMenu` (editar tasa / quitar). `CurrencyRateField` ya tiene **fetch real** (`fetchExchangeRate`, con manejo de sin-conexión y error) y entrada manual; marca `rateSource` según el origen. |
| Grupos recurrentes | `src/app/recurring-groups/index.tsx` | Lista con `OverflowMenu` (Renombrar vía `GroupNameDialog`, Eliminar permanentemente vía `Dialog` de confirmación). **Verifica antes de tocar nada:** `handleConfirmDelete` llama `trashRecurringGroup` **y luego `purgeRecurringGroup` en el mismo gesto** — parece ser una eliminación permanente inmediata, sin paso de papelera intermedio visible al usuario. Si es así, el texto de confirmación debe decirlo tal cual (nada de "se puede restaurar"); si tu lectura del código difiere, dilo en el plan de la fase 2 antes de tocar el texto. **Verifica también** qué pasa con `recurringGroupId` en los miembros al eliminar el grupo (¿queda `null` o se bloquea si tiene miembros?) y ajusta el texto a lo que el código realmente hace. |
| Archivo | `src/app/archive/index.tsx` | Selección múltiple, `Checkbox`, chip de tipo, `OverflowMenu` por fila, **`ConfirmRecordsDialog`** antes de restaurar (individual o en lote), mover a papelera inmediato (sin confirmar, a propósito). |
| Papelera | `src/app/trash/index.tsx` | Mismo patrón + "días para purgar" (`daysUntilPurge`) y confirmación también para el purgado permanente. |

### 3.3 Componentes que se reutilizan

`ActionSheet` (`src/components/ui/action-sheet.tsx`, de Presupuesto), `Chip` (`tone`:
`success`/`warning`/`danger`/neutro), `Switch`, `IconButton` (`name: {ios,android,web}`),
`SectionHeader` (con `trailingText` ya disponible), `Card`, `Button`
(`primary`/`secondary`/`ghost`/`danger`), `showToast(message, { actions? })` (sin límite
de tiempo si lleva acciones — ver comentario en `toast.ts`).

### 3.4 Textos actuales relevantes (`settings.*`, `es.json`)

Ver tabla completa en §8. Ya existen: `settings.title`, `settings.account.*`,
`settings.general.{defaultCurrency,language,theme,themeOption.*}`,
`settings.categories.*`, `settings.currencies.*`, `settings.recurringGroups.*`,
`settings.reminders.{title,enable,leadDays}`, `settings.data.{title,trashRetention,
archive,archiveCount,trash,trashCount}`. `common.{save,cancel,done,closeDialog,signOut,
restore,delete,remove,rename,deletePermanently,actionsFor}`.

---

## 4. Diseño de la pantalla raíz (fase 1)

### 4.1 Cuenta (sin cambios de comportamiento)

Igual que hoy: correo + Cerrar sesión, o "Crear cuenta / Iniciar sesión". No se toca en
esta iniciativa.

### 4.2 General → Moneda predeterminada

- **Fila** (patrón "manage row" ya usado en Categorías/Monedas/Grupos): título
  `settings.general.defaultCurrency`, valor actual a la derecha (`{símbolo} ({código})`,
  usa `SUPPORTED_CURRENCIES`/`formatCurrency` para el símbolo), chevron ‹›.
- **Al tocarla:** `ActionSheet` (`title = settings.general.defaultCurrency`) con las 16
  monedas de `SUPPORTED_CURRENCIES` (✓ en la actual). **No filtres por "agregada"**: la
  lista completa, como hoy.
- **Elegir una moneda ≠ la actual** abre, **dentro del mismo flujo** (puede ser una
  segunda vista de la misma hoja, o encadenar una segunda `ActionSheet` al cerrar la
  primera — tu elección, prioriza simplicidad), una **confirmación** con:
  - Título: `settings.general.currencyConfirm.title` ("Cambiar a {{currency}}").
  - Lista de 3 consecuencias (`settings.general.currencyConfirm.consequence1/2/3`, ver
    §8), en el mismo estilo de lista con ✓ que ya usa el detalle de Presupuesto o
    simplemente párrafos `caption` — tu elección de composición, pero deben ser 3 líneas
    separadas y legibles, no un solo párrafo largo.
  - Botones: `common.cancel` (vuelve a la lista de monedas o cierra) y un botón de acento
    `settings.general.currencyConfirm.confirm` ("Cambiar a {{currency}}").
- **Al confirmar:** `updateUserSettings({ defaultCurrency: code })` (dispara sin esperar
  el `await` para no bloquear el cierre de la hoja; el propio store ya encadena el
  bulk-stale de monedas y recomendaciones). Cierra la hoja. `showToast(t(
  'settings.general.currencyChanged', { currency }))`.
- **Si elige la misma moneda actual:** no hace nada, solo cierra.

### 4.3 General → Idioma

- **Fila** igual que Moneda: valor actual a la derecha (nombre del idioma).
- **`ActionSheet`** con la lista de `LANGUAGES` (hoy 2: `en`/`es`) y ✓ en el actual. Si
  `LANGUAGES.length > 8` en el futuro, añade un `TextField` de búsqueda arriba
  (normalizada, sin acentos/mayúsculas) — con solo 2 no es necesario ahora, pero **no
  bloquees** esa posibilidad: escribe el filtro simple igual, oculto cuando no hace
  falta, en vez de asumir que siempre serán 2. Usa una función pura
  `normalizeSearchText(value)` en `src/lib/` si la escribes, con su prueba.
- **Al elegir:** `updateUserSettings({ language })` (dispara sin esperar), cambia
  `i18n.changeLanguage(...)` si `settings.tsx` no lo hace ya en otro punto (**verifica**:
  el `i18next`/`react-i18next` de Stage 10 puede reaccionar solo al dato persistido, o
  necesitar el cambio explícito aquí — comprueba cómo cambia hoy `i18n.language` y
  replica ese mecanismo, no inventes uno nuevo). Cierra. `showToast(...)` con el nombre
  del idioma en el propio idioma elegido (`settings.general.languageChanged`).

### 4.4 General → Tema

Sin cambios de mecánica: los 3 `Chip` actuales, ya escriben `setTheme` local hoy; ahora
en vez de esperar a Guardar, cada toque llama `updateUserSettings({ theme: option })`
directo. **Sin toast** (el cambio de tema se ve al instante en toda la pantalla; un toast
sería ruido).

### 4.5 Recordatorios

- **Activar** (`Switch`): al cambiar, `updateUserSettings({ reminders: { ...current,
  enabled } })` inmediato. `showToast` con `settings.reminders.enabledOn`/`enabledOff`.
- **Días de anticipación** — **cambia de `TextField` a un stepper** (dos `IconButton`
  `minus`/`plus` con el número entre ambos, `ThemedText type="default"` con peso 700,
  ancho mínimo para no saltar de tamaño), rango **1–14** (deshabilita `−` en 1 y `+` en
  14). Visible solo si `enabled` es verdadero, igual que hoy.
  - **Debounce de escritura:** el número en pantalla cambia en cada toque **de
    inmediato** (estado local), pero la llamada a `updateUserSettings` se dispara **tras
    ~400 ms sin más toques** (usa un helper nuevo y probado, p. ej.
    `src/lib/debounce.ts` con `createDebouncedWriter(fn, delayMs)`, o `useRef` +
    `setTimeout` directo en el componente si prefieres no crear un archivo nuevo — tu
    elección, pero **documenta cuál usaste** en el reporte de fase). **Sin toast** en
    cada toque; el número visible ya es la confirmación.
  - `accessibilityLabel` del stepper: `settings.reminders.leadDaysValue` con el valor
    ("3 días").

### 4.6 Datos → Retención de la papelera

- **Cambia de `TextField` a una fila que abre un `ActionSheet`** con opciones fijas: **7,
  14, 30, 60, 90 días** (radios o filas con ✓, tu elección de composición — reutiliza el
  patrón de "lista con ✓ en la actual" de moneda/idioma). Sin campo libre.
- **Al elegir:** `updateUserSettings({ trashRetentionDays: value })` inmediato. Cierra.
  `showToast(t('settings.data.trashRetentionChanged', { count: value }))`.
- Este campo hoy es "funcionalmente inerte" (`CLAUDE.md`, Stage 10): nada lo consume
  todavía. Cambiar su representación de texto libre a opciones fijas es de bajo riesgo.

### 4.7 Filas de navegación (Categorías, Monedas, Grupos, Archivo, Papelera)

**Sin cambios de comportamiento.** Mantén los 5 "manage row" con conteo tal cual están
hoy (título + `caption` con el conteo + ‹›, navegando a su ruta). Son la referencia visual
de estilo para todo lo nuevo en la raíz: reutiliza `Card` + el mismo layout de fila.

### 4.8 Qué desaparece de la raíz

- El botón **"Guardar"**.
- El **botón de Cerrar sesión duplicado al final**. **Confirmado por el propietario: se
  retira**, aunque el comentario del código lo justificaba por una convención de UI
  (patrón Facebook/GitHub de repetir Cerrar sesión al final) y no por el Save que se
  retira — es una decisión aparte, ya tomada, no una consecuencia automática de quitar el
  Save. Queda un **solo** Cerrar sesión, en la fila de Cuenta (§4.1).

---

## 5. Reglas de negocio (RN-AJU)

| ID | Regla |
|---|---|
| RN-AJU-1 | Todo campo de la sección General y Recordatorios/Datos de Ajustes escribe **de inmediato** al cambiar. No existe un estado "sin guardar" en esta pantalla. |
| RN-AJU-2 | La única pausa antes de aplicar es el cambio de **moneda predeterminada**, con sus 3 consecuencias explícitas. Cambiar cualquier otro campo no muestra confirmación. |
| RN-AJU-3 | Los días de anticipación y la retención de la papelera se seleccionan de un conjunto acotado (stepper 1–14; opciones fijas 7/14/30/60/90), nunca de texto libre, para que el guardado inmediato nunca escriba un valor incompleto. |
| RN-AJU-4 | Ninguna escritura de esta pantalla bloquea la interacción esperando confirmación de red; la UI se actualiza por la caché local, igual que Categorías y Monedas. |
| RN-AJU-5 | El cambio de moneda predeterminada puede apuntar a **cualquiera** de las 16 monedas soportadas, esté "agregada" o no. |
| RN-AJU-6 | El aviso de éxito (`showToast`) aparece para: cambio de moneda, de idioma, de recordatorios (activar/desactivar) y de retención. **No** aparece para tema ni para el stepper de días (serían ruido en acciones muy frecuentes o ya visibles al instante). |
| RN-AJU-7 | Las subpantallas (Categorías, Monedas, Grupos, Archivo, Papelera) no cambian sus reglas de negocio en esta iniciativa; solo reciben ajustes cosméticos puntuales (fase 2). |

---

## 6. Fase 2 — cosmética puntual en las subpantallas

**No es una reconstrucción.** Antes de tocar cada archivo, compara su aspecto actual con
la pantalla raíz ya rediseñada (fase 1) y aplica **solo** lo que quede visiblemente
inconsistente. Ejemplos de lo que probablemente aplique (confírmalo mirando el resultado
real, no lo apliques a ciegas):

- Encabezados de sección con el mismo peso/tamaño que la raíz.
- Si alguna lista se beneficia de `SectionHeader.trailingText` para un conteo o resumen
  a la derecha (p. ej. "N archivados"), úsalo en vez de un `caption` suelto si mejora la
  consistencia — pero solo donde ya hay un encabezado de sección; no le agregues uno a
  una pantalla que no lo tenía.
- Espaciados (`Spacing.*`) y `Divider` entre filas, si difieren de la raíz.

**No hagas en esta fase:** cambiar `OverflowMenu` por `ActionSheet` en estas pantallas
(sería una reconstrucción de interacción, no cosmética — queda fuera de alcance),
cambiar el flujo de confirmación de Grupos/Archivo/Papelera, ni tocar `CurrencyRateField`
o `EmojiPicker`.

Si al mirar el resultado no encuentras nada que de verdad necesite cambiar, **dilo en el
plan de la fase y no hagas cambios cosméticos por hacer algo** — un PR vacío o casi vacío
con esa conclusión es un resultado válido.

---

## 7. Accesibilidad (checklist)

- Objetivos táctiles ≥ 44: fila de cada control, botones del stepper, opciones de las
  hojas, ✓ de selección.
- `accessibilityRole="button"` + `accessibilityLabel` en cada fila que abre una hoja
  (patrón ya usado en las filas de navegación existentes).
- Estado seleccionado en las hojas de moneda/idioma/retención: `accessibilityState={{
  selected: true }}` en la opción actual, no solo el ✓ visual.
- Tema: los 3 `Chip` ya usan `tone` para marcar el activo; confirma que no dependa solo
  del color (el texto del chip ya lo distingue, verifica que sea suficiente o añade
  `accessibilityState={{ selected }}`).
- Stepper: `accessibilityRole="adjustable"` o equivalente con `accessibilityValue={{ min:
  1, max: 14, now: leadDays }}`, y anuncia el valor tras cada cambio
  (`accessibilityLiveRegion`/`aria-live` si aplica en la plataforma).
- Escala de fuente al 150 %: nada se corta, incluida la confirmación de moneda con sus 3
  líneas.
- Contraste ≥ 4,5:1 en claro y oscuro (tokens existentes).

---

## 8. Textos (`es.json` / `en.json`, mismas claves)

**Se mantienen sin cambios:** `settings.title`, `settings.account.*`,
`settings.general.{defaultCurrency,language,theme,themeOption.*}`,
`settings.categories.*`, `settings.currencies.*`, `settings.recurringGroups.*`,
`settings.reminders.{title,enable,leadDays}`, `settings.data.{title,archive,
archiveCount,trash,trashCount}`.

**Se retiran si quedan sin uso** (verifica con `grep` antes de borrar):
`settings.data.trashRetention` (el label del `TextField` que desaparece; puede
reutilizarse como título de la hoja, ver abajo).

**Nuevas / a confirmar:**

| Clave | es | en |
|---|---|---|
| `settings.general.currencyConfirm.title` | Cambiar a {{currency}} | Change to {{currency}} |
| `settings.general.currencyConfirm.consequence1` | Tus monedas agregadas quedarán como "Necesita actualización" hasta que confirmes su tasa hacia {{currency}}. | Your added currencies will be marked "Needs refresh" until you confirm their rate against {{currency}}. |
| `settings.general.currencyConfirm.consequence2` | Las recomendaciones de presupuesto se recalcularán. | Budget recommendations will be recalculated. |
| `settings.general.currencyConfirm.consequence3` | Tus pagos y registros anteriores no cambian: conservan su monto y su tasa de entonces. | Your past payments and records don't change: they keep their original amount and rate. |
| `settings.general.currencyConfirm.confirm` | Cambiar a {{currency}} | Change to {{currency}} |
| `settings.general.currencyChanged` | Moneda predeterminada: {{currency}}. | Default currency: {{currency}}. |
| `settings.general.languageChanged` | Idioma: {{language}}. | Language: {{language}}. |
| `settings.general.searchLanguage` | Buscar idioma | Search language |
| `settings.general.noLanguageResults` | Sin resultados. | No results. |
| `settings.reminders.enabledOn` | Recordatorios activados. | Reminders turned on. |
| `settings.reminders.enabledOff` | Recordatorios desactivados. | Reminders turned off. |
| `settings.reminders.leadDaysValue` | {{count}} día de anticipación / {{count}} días de anticipación | {{count}} day's notice / {{count}} days' notice |
| `settings.reminders.leadDaysDecrease` | Un día menos | One day less |
| `settings.reminders.leadDaysIncrease` | Un día más | One day more |
| `settings.data.trashRetentionSheetTitle` | Retención de la papelera | Trash retention |
| `settings.data.trashRetentionOption` | {{count}} días | {{count}} days |
| `settings.data.trashRetentionChanged` | La papelera conservará lo eliminado {{count}} días. | Trash will keep deleted items for {{count}} days. |

Si el helper de búsqueda de idioma no se activa (lista corta), sus claves quedan
reservadas para cuando haga falta; no las borres.

---

## 9. Preguntas que debes hacerme **antes** de la fase 1

**P1.** ¿Cómo cambia hoy `i18n.language` cuando el idioma persistido cambia — reacciona
solo (efecto en `_layout.tsx` o similar) o hace falta llamar `i18n.changeLanguage(...)`
explícitamente desde donde se guarda? Léelo en el código y dime tu hallazgo (no hace
falta que apruebe esto; solo repórtalo en tu plan de fase para que quede documentado).

**P2.** ¿Prefieres que la confirmación de moneda (§4.2) sea una **segunda vista dentro
de la misma `ActionSheet`** (volver atrás sin cerrar) o **una segunda hoja encadenada**?
Ambas cumplen la regla; elige la que te resulte más simple de implementar con el
`ActionSheet` actual y dilo en tu plan.

**P3.** *(Resuelta — ver §4.8.)* El botón de Cerrar sesión duplicado al final de la
pantalla se retira. Queda un solo Cerrar sesión, en la fila de Cuenta. No es necesario
preguntarlo de nuevo en el plan de fase.

**P4.** Grupos recurrentes (§3.2): confirma leyendo `store/recurring-groups.ts` si
"Eliminar permanentemente" hoy deja a los miembros sin grupo o si el flujo real es otro.
Repórtalo; si cambia algo de lo que digo en la §3.2, dime tu lectura antes de tocar
cualquier texto de esa pantalla en la fase 2.

Responde P1 y P4 como hallazgos de código en tu plan; P2 es una decisión tuya de
implementación. P3 ya está resuelta (ver arriba).

---

## 10. Plantilla de reporte de cada fase

```
Ajustes redesign — fase N: <nombre>
Rama: <rama> · Commit: <hash> · Árbol limpio: sí
Origen: develop @ <hash>
tsc --noEmit: <ok> · npm run lint: <ok> · npm test: <n>/<n>
Archivos tocados: <lista>
Desviaciones del plan aprobado: <lista o "ninguna">
Claves i18n añadidas/cambiadas/retiradas: <lista>
Verificación manual (claro/oscuro, 150 %, dataset §11): <checklist>
Dudas abiertas: <lista o "ninguna">
```

---

## 11. Dataset de verificación

No hay un prototipo HTML para esta página; verifica con datos reales o sembrados:

- **Cuenta anónima:** debe verse "Crear cuenta / Iniciar sesión".
- **Cuenta con sesión:** correo + botón Cerrar sesión en la fila de Cuenta, y **ningún**
  otro botón de Cerrar sesión al final de la pantalla.
- **Moneda predeterminada = GTQ, sin monedas agregadas:** la hoja debe listar las 16
  monedas con ✓ en GTQ; elegir USD dispara la confirmación con las 3 consecuencias;
  confirmar deja `defaultCurrency='USD'`, marca `stale` cualquier moneda agregada
  existente y cualquier `budgetRecommendation` existente (compruébalo en Firestore o en
  el emulador).
- **Idioma:** elegir "English" cambia los textos de la propia hoja de Ajustes al instante
  (título de las secciones, etc.) sin recargar.
- **Recordatorios activados, 3 días:** el stepper muestra "3"; tocar "+" cuatro veces
  seguidas rápido debe producir **una sola escritura** final a "7" (verifícalo con un
  log temporal o el inspector de red/Firestore, no lo dejes en el código final).
- **Retención en 30 (valor sembrado):** abrir la hoja debe marcar ✓ en "30 días"; elegir
  "60" lo aplica y cierra.
- **Fuente del sistema al 150 %:** ninguna fila ni la confirmación de moneda se corta.
