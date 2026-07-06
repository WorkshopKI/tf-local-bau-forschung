/**
 * @deprecated Seit Journey-Paket 2 (Phase 1) lebt die Handlungs-Formel im Core:
 * `@/core/utils/naechsterSchritt`. Sie ist jetzt gemeinsame Infrastruktur für
 * Home UND die Förderanträge-Liste und kennt zusätzlich den PreCheck-Stand.
 *
 * Dieser Re-Export bleibt als Brücke für etwaige externe Referenzen — neuer
 * Code importiert direkt aus dem Core.
 */
export { naechsterSchritt, normalisierePrecheck } from '@/core/utils/naechsterSchritt';
export type { NaechsterSchritt, PrecheckKlasse } from '@/core/utils/naechsterSchritt';
