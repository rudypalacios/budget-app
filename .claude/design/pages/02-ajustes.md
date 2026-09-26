# Ajustes — instrucciones de implementación

> **Destinatario:** Claude Code, trabajando en el repo `rudypalacios/budget-app`.
> **Ubicación de estos archivos:** `.claude/design/pages/02-ajustes.md` (este documento).
> **Hay un prototipo HTML de referencia: `.claude/design/prototypes/ajustes-v2.html`.**
> Es una sola página (SPA) que cubre la pantalla raíz **y** las subpantallas Monedas,
> Categorías (con su formulario), Grupos recurrentes, Archivo y Papelera — ábrelo en un
> navegador y navega entre ellas antes de escribir código. Es la referencia de anatomía
> visual y de comportamiento **obligatoria** para toda esta iniciativa, con el mismo
> peso que tuvo `presupuesto-v9.html` para Presupuesto. Donde el prototipo y este
> documento describan lo mismo, son la misma fuente; si notas una diferencia entre
> ambos, este documento manda para reglas de negocio y el prototipo manda para
> anatomía visual — pero avísamelo, porque no debería haber ninguna.
>
> Verificado contra `develop` en el commit `26fc7c9` (ya incluye el rediseño de
> Presupuesto: `ActionSheet`, `showToast` con acciones, `SectionHeader.trailingText`).
> Si `develop` avanzó, vuelve a comprobar los datos de la §3 antes de codificar.
>
> **Las decisiones tomadas durante la implementación (fases 1 y 2) están en la §12 y
> prevalecen sobre cualquier texto anterior de este documento que las contradiga.**

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
   página no las necesita. (Excepción aprobada: `@tabler/icons-react-native` para los
   iconos de categoría, fase 2b — ver §12.)
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
confirmación (§4.2). La app ya es offline-first vía la caché local de Firestore
(`createDocumentStore`/`createCollectionStore`: la UI se actualiza al instante por el
propio `onSnapshot`, haya o no red), así que el guardado inmediato no es menos seguro que
categorías/monedas, que ya funcionan así.

**Consecuencia de diseño, no solo de arquitectura:** dos campos dejan de ser `TextField`
libre y pasan a controles de opciones discretas (§4.5, §4.6), precisamente para que el
guardado inmediato nunca escriba un valor a medio teclear.

Actualiza el comentario de `CLAUDE.md` en el cierre (fase 3) para que dependa de esta
nueva decisión y no de la anterior.

---

## 2. Alcance

**Dentro:** `src/app/(tabs)/settings.tsx` (reescritura sustancial), un helper nuevo en
`src/lib/` para el debounce del stepper, textos de `es.json`/`en.json`, documentación.
Reskin visual de `src/app/categories/*`, `src/app/currencies/*`,
`src/app/recurring-groups/index.tsx`, `src/app/archive/index.tsx`, `src/app/trash/index.tsx`
(fase 2, §6).

**Fuera (no tocar):** el modelo de datos, `firestore.rules`, `CurrencyRateField`
(incluida `fetchExchangeRate`, ya real y funcional), el motor de
`markBudgetRecommendationsStale`/`markCurrenciesStale`, Panel, Gastos, Ingresos,
Historial, Presupuesto. (Ampliaciones aprobadas durante la implementación — `EmojiPicker`,
`lifecycle-records.ts`, `lifecycle-actions.ts`, `ConfirmRecordsDialog` — en la §12.)

---

## 3. Estado actual verificado en `develop` (`26fc7c9`)

### 3.1 La pantalla raíz (lo que más cambia)

| Archivo | Qué hace hoy |
|---|---|
| `src/app/(tabs)/settings.tsx` (351 líneas) | `SettingsForm` con **estado local** (`useState`) para `currency, language, theme, remindersEnabled, leadDays, trashRetentionDays`, inicializado una vez desde `settings` cargado. Un único `handleSave` async llama `updateUserSettings(...)` con **todo el patch junto**. Secciones: Cuenta (correo o "Crear cuenta/Iniciar sesión" + Cerrar sesión), General (`Select` moneda con `SUPPORTED_CURRENCIES` completo, `Select` idioma con `LANGUAGES`, chips de tema), filas de navegación a Categorías/Monedas/Grupos (con conteo), Recordatorios (`Switch` + `TextField` condicional), Datos (`TextField` retención + filas a Archivo/Papelera), botón Guardar, botón Cerrar sesión duplicado al final. |
| `src/store/user-settings.ts` | `updateUserSettings(patch)`: `store.update(patch)` y, **solo si `defaultCurrency` cambió**, dispara en la misma llamada `markBudgetRecommendationsStale()` (bulk `budgetRecommendation.status='stale'` en todas las `recurringExpenses`) y `markCurrenciesStale()` (bulk `status='stale'` en todas las `currencies`), vía `firestoreClient.batchUpdate`. **Esta función y su side-effect de moneda no cambian.** |
| `src/store/create-document-store.ts` | `update()` hace `await firestoreClient.updateDoc(...)`; la UI ya refleja el cambio antes por el listener `onSnapshot` local (`fromCache`/`hasPendingWrites` ya expuestos en el estado). **No esperes el `Promise` para actualizar la UI**: dispáralo y sigue (mismo patrón que Categorías/Monedas). |
| `src/constants/currencies.ts` | `SUPPORTED_CURRENCIES`: **15 monedas fijas** (GTQ, USD, EUR, MXN, CAD, GBP, COP, ARS, CLP, PEN, BRL, DOP, HNL, CRC, PAB). No es una lista abierta; no se agregan monedas nuevas al catálogo. |
| `src/store/currencies.ts` | `addCurrency(code, rate, source)`, `updateCurrencyRate`, `removeCurrency`, `getConfiguredRate`. ID determinístico = el código. |
| **Importante:** la moneda predeterminada **no** tiene que estar en la lista de "monedas agregadas". El `Select` actual ya ofrece las 15 de `SUPPORTED_CURRENCIES`, agregada o no, sin filtrar por `status`. Cambiar el default a una moneda nunca agregada es válido (su tasa relativa a sí misma es 1; no necesita fila en `currencies`). | |

### 3.2 Subpantallas — **ya bien construidas, no las rediseñes de cero**

Cada una es una ruta propia, ya escribe de inmediato (sin Save) y ya sigue buenas
prácticas de confirmación y accesibilidad. La fase 2 es un **reskin visual**, no una
reconstrucción de lógica.

| Pantalla | Archivo | Ya tiene |
|---|---|---|
| Categorías | `src/app/categories/index.tsx` + `src/components/category-form.tsx` | Lista con `Switch` activar/archivar, `Dialog` de eliminar (bloqueado si `canDeleteCategory` dice que hay registros dependientes), formulario con `EmojiPicker` (grid de 32 emoji + vista previa en el propio botón) y sugerido de presupuesto. |
| Monedas | `src/app/currencies/index.tsx` + `.../new.tsx` + `.../[code]/edit.tsx` | Lista con tasa, chip "Necesita actualización" si `stale`, `OverflowMenu` (editar tasa / quitar). `CurrencyRateField` ya tiene **fetch real** (`fetchExchangeRate`, con manejo de sin-conexión y error) y entrada manual; marca `rateSource` según el origen. |
| Grupos recurrentes | `src/app/recurring-groups/index.tsx` | Lista con `OverflowMenu` (Renombrar vía `GroupNameDialog`, Eliminar permanentemente vía `Dialog` de confirmación). `handleConfirmDelete` llama `trashRecurringGroup` y luego `purgeRecurringGroup` en el mismo gesto: eliminación permanente inmediata; los miembros conservan su `recurringGroupId` (apuntando a un grupo inexistente) y se ven sin agrupar. Ver §12 para la regla nueva. |
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

Igual que hoy: correo + Cerrar sesión, o "Crear cuenta / Iniciar sesión". Cerrar sesión
es directo, sin confirmación (§12).

### 4.2 General → Moneda predeterminada

- **Fila** (patrón "manage row" ya usado en Categorías/Monedas/Grupos): título
  `settings.general.defaultCurrency`, valor actual a la derecha (`{símbolo} ({código})`,
  usa `SUPPORTED_CURRENCIES`/`formatCurrency` para el símbolo), chevron ‹›.
- **Al tocarla:** `ActionSheet` (`title = settings.general.defaultCurrency`) con las 15
  monedas de `SUPPORTED_CURRENCIES` (✓ en la actual). **No filtres por "agregada"**: la
  lista completa, como hoy.
- **Elegir una moneda ≠ la actual** abre, **dentro del mismo flujo**, una
  **confirmación** con:
  - Título: `settings.general.currencyConfirm.title` ("Cambiar a {{currency}}").
  - Lista de 3 consecuencias (`settings.general.currencyConfirm.consequence1/2/3`, ver
    §8), 3 líneas separadas y legibles, no un solo párrafo largo.
  - Botones: `common.cancel` (vuelve a la lista de monedas) y
    `settings.general.currencyConfirm.confirm` ("Cambiar a {{currency}}").
- **Al confirmar:** `updateUserSettings({ defaultCurrency: code })` (dispara sin esperar
  el `await` para no bloquear el cierre de la hoja; el propio store ya encadena el
  bulk-stale de monedas y recomendaciones). Cierra la hoja. `showToast(t(
  'settings.general.currencyChanged', { currency }))`.
- **Si elige la misma moneda actual:** no hace nada, solo cierra.

### 4.3 General → Idioma

- **Fila** igual que Moneda: valor actual a la derecha (nombre del idioma).
- **`ActionSheet`** con la lista de `LANGUAGES` (hoy 2: `en`/`es`) y ✓ en el actual. Si
  `LANGUAGES.length > 8` en el futuro, se muestra un `TextField` de búsqueda arriba
  (normalizada con `normalizeSearchText`, sin acentos/mayúsculas); el filtro ya está
  escrito, oculto mientras no hace falta.
- **Al elegir:** `updateUserSettings({ language })` (dispara sin esperar). No hace falta
  `i18n.changeLanguage(...)`: `_layout.tsx` ya sigue al idioma persistido (P1). Cierra.
  `showToast(...)` con el nombre del idioma en el propio idioma elegido
  (`settings.general.languageChanged`).

### 4.4 General → Tema

Cada toque llama `updateUserSettings({ theme: option })` directo. **Sin toast** (el
cambio de tema se ve al instante en toda la pantalla; un toast sería ruido).

### 4.5 Recordatorios

- **Activar** (`Switch`): al cambiar, `updateUserSettings({ reminders: { ...current,
  enabled } })` inmediato. `showToast` con `settings.reminders.enabledOn`/`enabledOff`.
- **Días de anticipación** — stepper (−/+ con el número entre ambos, ancho mínimo para
  no saltar de tamaño), rango **1–14** (deshabilita `−` en 1 y `+` en 14). Visible solo
  si `enabled` es verdadero.
  - **Debounce de escritura:** el número en pantalla cambia en cada toque **de
    inmediato** (estado local), pero la llamada a `updateUserSettings` se dispara **tras
    ~400 ms sin más toques** (`createDebouncedWriter` en `src/lib/debounce.ts`). **Sin
    toast** en cada toque.
  - `accessibilityLabel` del número: `settings.reminders.leadDaysValue` con el valor.
- **Hora del aviso** (añadida en la fase 2, §12): fila con hoja de opciones fijas (sin
  hora fija, 8:00, 9:00, 12:00, 18:00, 20:00) que escribe `reminders.timeOfDay`.

### 4.6 Datos → Retención de la papelera

- Fila que abre un `ActionSheet` con opciones fijas: **7, 14, 30, 60, 90 días**. Sin
  campo libre.
- **Al elegir:** `updateUserSettings({ trashRetentionDays: value })` inmediato. Cierra.
  `showToast(t('settings.data.trashRetentionChanged', { count: value }))`.
- Nada borra todavía de forma automática (el TTL de Firestore no está activo), pero el
  valor **sí** se usa: cada `trashX()` lo lee para calcular `purgeAt`, que la Papelera
  muestra como "N días para la eliminación permanente".

### 4.7 Filas de navegación (Categorías, Monedas, Grupos, Archivo, Papelera)

**Sin cambios de comportamiento.** Cada fila navega a su ruta y muestra su conteo.

### 4.8 Qué desaparece de la raíz

- El botón **"Guardar"**.
- El **botón de Cerrar sesión duplicado al final**. Queda un **solo** Cerrar sesión, en
  la sección de Cuenta (§4.1).

---

## 5. Reglas de negocio (RN-AJU)

| ID | Regla |
|---|---|
| RN-AJU-1 | Todo campo de la sección General y Recordatorios/Datos de Ajustes escribe **de inmediato** al cambiar. No existe un estado "sin guardar" en esta pantalla. |
| RN-AJU-2 | La única pausa antes de aplicar es el cambio de **moneda predeterminada**, con sus 3 consecuencias explícitas. Cambiar cualquier otro campo no muestra confirmación. |
| RN-AJU-3 | Los días de anticipación y la retención de la papelera se seleccionan de un conjunto acotado (stepper 1–14; opciones fijas 7/14/30/60/90), nunca de texto libre, para que el guardado inmediato nunca escriba un valor incompleto. |
| RN-AJU-4 | Ninguna escritura de esta pantalla bloquea la interacción esperando confirmación de red; la UI se actualiza por la caché local, igual que Categorías y Monedas. |
| RN-AJU-5 | El cambio de moneda predeterminada puede apuntar a **cualquiera** de las 15 monedas soportadas, esté "agregada" o no. |
| RN-AJU-6 | El aviso de éxito (`showToast`) aparece para: cambio de moneda, de idioma, de recordatorios (activar/desactivar), de hora del aviso y de retención. **No** aparece para tema ni para el stepper de días (serían ruido en acciones muy frecuentes o ya visibles al instante). |
| RN-AJU-7 | Las subpantallas (Categorías, Monedas, Grupos, Archivo, Papelera) no cambian sus reglas de negocio en esta iniciativa, salvo las decisiones de la §12; reciben un reskin visual (fase 2) guiado por `ajustes-v2.html` (§6). |
| RN-AJU-8 | Cambiar la moneda predeterminada **nunca modifica registros existentes** (gastos, ingresos, recurrentes: conservan su monto y su moneda); solo afecta a lo que se crea después. |

---

## 6. Fase 2 — reskin visual de las subpantallas

**No es una reconstrucción de interacción ni de lógica.** Es un reskin visual: mismos
componentes, mismo flujo de navegación, misma lógica de negocio — pero con la anatomía
visual (color, iconografía, tarjetas, tipografía, chips) que ya muestra
`.claude/design/prototypes/ajustes-v2.html` para Monedas, Categorías (+ su formulario),
Grupos recurrentes, Archivo y Papelera. Ese prototipo es la referencia obligatoria para
las cinco, con el mismo peso que tuvo `presupuesto-v9.html` para Presupuesto — ábrelo y
navega cada una de sus pantallas antes de tocar el código correspondiente.

Para cada subpantalla, antes de escribir código: ábrela junto al archivo real
correspondiente y compara fila por fila — iconos/círculos de color, chips, tipografía,
espaciado, cómo se ve cada hoja inferior o formulario. Replica la anatomía visual con
los componentes reales que ya existen; si algo del prototipo no tiene un componente real
equivalente, dilo en tu plan y pregúntame antes de crear uno nuevo solo para esto.

**Qué NO cambia aunque el prototipo lo dibuje de una forma simplificada:** la lógica real
de `fetchExchangeRate` (con su manejo de sin-conexión), `addCurrency`/
`updateCurrencyRate`/`removeCurrency`, `canDeleteCategory`, `CurrencyRateField`. El
prototipo usa datos de ejemplo y omite casos de error de red — no repliques esas
simplificaciones, solo la anatomía visual.

**Qué SÍ puede cambiar de interacción, porque el propio prototipo ya lo muestra así:**
si `ajustes-v2.html` dibuja una hoja inferior (`#sheet`) donde hoy el código real usa
otra cosa (p. ej. la confirmación de retención, o agregar/actualizar moneda), sí
adóptalo. Lo que no debes hacer es ir más allá de lo que el prototipo muestra (por
ejemplo, no conviertas Categorías o Grupos a hoja inferior si el prototipo los muestra
como pantalla propia).

Si al comparar alguna pantalla no encuentras nada que de verdad necesite cambiar, **dilo
en el plan de la fase y no hagas cambios cosméticos por hacer algo**.

---

## 7. Accesibilidad (checklist)

- Objetivos táctiles ≥ 44: fila de cada control, botones del stepper, opciones de las
  hojas, ✓ de selección.
- `accessibilityRole="button"` + `accessibilityLabel` en cada fila que abre una hoja.
- Estado seleccionado en las hojas de moneda/idioma/retención/hora:
  `accessibilityState={{ selected: true }}` en la opción actual, no solo el ✓ visual.
- Tema: el control segmentado marca el activo con `accessibilityState={{ selected }}`,
  no solo con color.
- Stepper: botones etiquetados (`leadDaysDecrease`/`leadDaysIncrease`) y el valor con
  `accessibilityLiveRegion` para anunciarlo tras cada cambio.
- Acciones deshabilitadas en las hojas (p. ej. eliminar una categoría en uso): visibles,
  con `accessibilityState={{ disabled: true }}` y el motivo en la descripción.
- Escala de fuente al 150 %: nada se corta, incluida la confirmación de moneda.
- Contraste ≥ 4,5:1 en claro y oscuro (tokens existentes).

---

## 8. Textos (`es.json` / `en.json`, mismas claves)

**Se mantienen sin cambios:** `settings.title`, `settings.account.*`,
`settings.general.{defaultCurrency,language,theme,themeOption.*}`,
`settings.categories.{title,count}`, `settings.recurringGroups.{title,count}`,
`settings.reminders.{title,enable,leadDays}`, `settings.data.{title,archive,
archiveCount,trash}`.

**Retiradas por quedar sin uso** (verificado con `grep`): `settings.data.trashRetention`,
`settings.{categories,currencies,recurringGroups}.manage`, `settings.currencies.count`,
`settings.data.trashCount` y las claves de las pantallas anteriores de Monedas,
Categorías y Grupos que el reskin dejó sin uso.

**Nuevas (fase 1):**

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

Las claves de la fase 2 (subpantallas, hora del aviso, nombres de moneda en
`currencies.names.*`) se listan en el reporte de su PR.

Si el helper de búsqueda de idioma no se activa (lista corta), sus claves quedan
reservadas para cuando haga falta; no las borres.

---

## 9. Preguntas de la fase 1 (resueltas)

**P1.** `i18n.language` cambia solo: `_layout.tsx` tiene un efecto que llama
`i18n.changeLanguage(...)` cuando `userSettings.language` difiere del actual. No hace
falta llamarlo desde Ajustes.

**P2.** La confirmación de moneda es una **segunda vista dentro de la misma
`ActionSheet`** (evita encadenar dos `Modal`).

**P3.** El botón de Cerrar sesión duplicado al final se retira.

**P4.** Eliminar un grupo hacía `trash` + `purge` inmediatos; los miembros conservaban
un `recurringGroupId` colgante y se veían sin agrupar. Reemplazado por la regla de la
§12 (D-AJU-6).

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

Además de comparar con el prototipo, verifica con datos reales o sembrados:

- **Cuenta anónima:** debe verse "Crear cuenta / Iniciar sesión".
- **Cuenta con sesión:** correo + Cerrar sesión en la sección de Cuenta, y **ningún**
  otro botón de Cerrar sesión al final de la pantalla.
- **Moneda predeterminada = GTQ, sin monedas agregadas:** la hoja debe listar las 15
  monedas con ✓ en GTQ; elegir USD dispara la confirmación con las 3 consecuencias;
  confirmar deja `defaultCurrency='USD'`, marca `stale` cualquier moneda agregada
  existente y cualquier `budgetRecommendation` existente, y **no** modifica ningún
  gasto, ingreso ni recurrente existente.
- **Idioma:** elegir "English" cambia los textos de la propia hoja de Ajustes al instante.
- **Recordatorios activados, 3 días:** tocar "+" cuatro veces seguidas rápido debe
  producir **una sola escritura** final a "7".
- **Retención en 30:** abrir la hoja marca "30 días"; elegir "60" lo aplica y cierra.
- **Grupo con historial:** "Eliminar permanentemente" aparece deshabilitado con el
  motivo; archivarlo lo mueve a "Archivados" y a la pantalla Archivo; restaurarlo desde
  Archivo lo reactiva y sus gastos vuelven a verse agrupados.
- **Archivo:** restaurar un gasto/ingreso/recurrente archivado lo devuelve a activo.
- **Fuente del sistema al 150 %:** ninguna fila, hoja ni confirmación se corta.

---

## 12. Decisiones tomadas por el propietario (no reabrir)

| # | Tema | Decisión |
|---|---|---|
| D-AJU-1 | Guardado | Escritura inmediata por campo; sin botón Guardar (§1). |
| D-AJU-2 | Cerrar sesión | Directo, sin confirmación (el prototipo la dibuja; no se adopta). Un solo botón, en Cuenta. |
| D-AJU-3 | Moneda predeterminada | Lista completa de 15 monedas (no solo las agregadas, como dibuja el prototipo) y 3 consecuencias (sin la 4.ª del prototipo). Cambiarla **no** toca ningún registro existente (RN-AJU-8); el store no añade la moneda anterior a "agregadas". |
| D-AJU-4 | Retención de la papelera | Tocar una opción aplica y cierra (sin botones Cancelar/Guardar en la hoja). |
| D-AJU-5 | Hora del aviso | Se añade a Recordatorios (opciones fijas, `reminders.timeOfDay`). La nota "cada recurrente puede tener su propio aviso: se cambia en Gastos" del prototipo **no** se muestra: esa opción no existe todavía. |
| D-AJU-6 | Eliminar un grupo recurrente | Solo si ningún registro (gasto, instancia o recurrente, en cualquier estado) lo usa. Si tiene historial, solo se archiva: deja de ofrecerse, sus gastos conservan el grupo y se reactiva desde Grupos o desde Archivo. Mismo criterio que categorías. Los grupos no pasan por la Papelera. |
| D-AJU-7 | Categorías predeterminadas | Se pueden eliminar si nada las usa (regla actual); el prototipo las bloquea siempre, no se adopta. |
| D-AJU-8 | Iconos de categoría | Iconos de trazo de Tabler Icons (los del prototipo), vía el paquete `@tabler/icons-react-native` con importación por icono. Fase 2b. Los emojis ya guardados se siguen mostrando hasta editar la categoría. |
| D-AJU-9 | Formulario de categoría | Validación de nombre duplicado y presupuesto negativo; "¿Descartar cambios?" al cancelar con cambios; el sugerido se ofrece con "Usar sugerido" en vez de precargarse. |
| D-AJU-10 | Monedas | Nombres de moneda traducidos (`currencies.names.*`); conteo de registros pendientes por moneda; agregar/editar en hoja inferior; "Quitar moneda" dentro de la hoja de edición. |
| D-AJU-11 | Confirmaciones de Archivo/Papelera | Hoja inferior (`ConfirmRecordsSheet`, antes `ConfirmRecordsDialog`). |
| D-AJU-12 | Texto de la Papelera | Se usa el del prototipo ("se borra para siempre pasados N días"). El propietario activará el TTL de Firestore con los pasos que se le entreguen al cerrar la iniciativa. |
