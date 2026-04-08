# Prompt: Tooltip Fixes — Kontrast und Clipping

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Zwei Probleme mit der Tooltip-Komponente (src/ui/Tooltip.tsx):

═══════════════════════════════════════════════════
FIX 1: Zu harter Kontrast
═══════════════════════════════════════════════════

Aktuell: Tooltip hat pechschwarzen Hintergrund mit weißem Text.
Das wirkt hart und unpassend im warm-grauen Design.

Ändere:
- Hintergrund: var(--tf-bg-secondary) statt var(--tf-text)
- Text: var(--tf-text) statt var(--tf-bg)
- Border: 0.5px solid var(--tf-border-hover)
- Schatten: keinen (Design Guide: kein box-shadow)

Das ergibt einen dezenten Tooltip der zum Rest der App passt —
wie ein Infokasten, nicht wie ein Fremdkörper.

═══════════════════════════════════════════════════
FIX 2: Linker Tooltip wird abgeschnitten
═══════════════════════════════════════════════════

Der erste Tooltip (P@3) sitzt ganz links und das Popup ragt
über den linken Viewport-Rand hinaus.

Lösung: Tooltip-Position dynamisch berechnen.

Im Tooltip-Rendering:
1. Ref auf das Tooltip-Popup-Element
2. Nach dem Rendern (useEffect oder useLayoutEffect):
   - getBoundingClientRect() des Popups lesen
   - Wenn left < 8px: setze left = 8px (oder transform anpassen)
   - Wenn right > window.innerWidth - 8px: nach links verschieben
3. Das Dreieck (::after) muss mitverschoben werden damit es noch
   auf das Quell-Element zeigt

Einfachere Alternative (wenn CSS-only bevorzugt):
- Tooltip standardmäßig links-ausgerichtet (left: 0) statt zentriert
  für Elemente die am linken Rand sitzen
- Oder: Tooltip immer rechts-ausgerichtet zeigen (left: 0, transform: none)
  und das Dreieck entsprechend positionieren

Pragmatischste Lösung:
- Tooltip UNTER dem Element statt ÜBER dem Element anzeigen
- Position: left: 50%, transform: translateX(-50%)
- Wenn das Popup am Rand clippt: clamp den left-Wert mit
  max(0px, min(calc(50% - popupWidth/2), calc(100vw - popupWidth)))

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. Hover über "P@3" (ganz links) → Tooltip wird NICHT abgeschnitten
2. Hover über "Top-1 Accuracy" (ganz rechts) → Tooltip wird NICHT abgeschnitten
3. Tooltip-Hintergrund passt zum Design (warm-grau, nicht schwarz)
4. Tooltip-Text gut lesbar (genug Kontrast, aber nicht hart)
5. Dreieck/Pfeil zeigt auf das richtige Element
6. Dark Mode: Tooltip sieht auch dort gut aus

Committe und pushe: "fix: tooltip contrast and left-edge clipping"
```
