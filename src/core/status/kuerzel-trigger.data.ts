/**
 * GENERIERT — nicht von Hand bearbeiten.
 *
 * Quelle: `docs/status-system/kuerzel-zuarbeit/trigger-regeln.csv`
 * Erzeuger: `scripts/gen-kuerzel-trigger.mjs` (`npm run gen:kuerzel-trigger`)
 *
 * Die Statuswechsel-Regeln des Fachsystems, wie sie in der Bemerkungsspalte der
 * Kürzel-Zuarbeit stehen. **Alle mit `aktiv: false`**: importiert heißt hier
 * erfasst und prüfbar, nicht wirksam. Sie zu aktivieren ist eine eigene
 * Entscheidung — die App leitet keinen Status ab (Pitfall #44), und eine
 * versehentlich scharf geschaltete Regel täte genau das.
 *
 * `benachrichtigt` und `zielStatus` sind getrennt, weil die Prosa sie
 * vermischt: „trigger an AB, Stw TV auf abgebrochen" ist eine Nachricht UND ein
 * Statuswechsel. `original` steht überall dabei — bei Zweifeln gilt er.
 */

/** Was die Regel voraussetzt. `unstrukturiert` = Prosa, die niemand geparst hat. */
export type TriggerBedingung =
  | { art: 'aggregation-tv'; quantor: 'alle' | 'kein'; kuerzel: string; roh: string }
  | { art: 'status-vorbedingung'; negiert: boolean; roh: string }
  | { art: 'kuerzel-gesetzt'; negiert: boolean; kuerzel: string; roh: string }
  | { art: 'unstrukturiert'; roh: string };

export interface KuerzelTriggerRegel {
  kuerzel: string;
  projektform: string;
  /** `null` = die Zuarbeit sagt nicht, worauf sich der Wechsel bezieht. */
  scope: 'tv' | 'verbund' | 'tv+verbund' | null;
  zielStatus?: {
    /** Wortlaut der Zuarbeit — inklusive Tippfehler. */
    roh: string;
    /** Amtlicher Code; `null`, wenn der Text nicht auflösbar war. */
    code: number | null;
    aufloesbar: boolean;
  };
  bedingung?: TriggerBedingung;
  /** Empfänger der Benachrichtigung. NIE mit dem Statuswechsel vermischen. */
  benachrichtigt: readonly string[];
  /** Der Originalsatz. Bei Zweifeln gilt er, nicht der Parser. */
  original: string;
  /** Immer `false` beim Import. */
  aktiv: false;
}

export const KUERZEL_TRIGGER_REGELN: readonly KuerzelTriggerRegel[] = [
  {"kuerzel":"AAE","projektform":"NW","scope":"tv","zielStatus":{"roh":"beantragt","code":31,"aufloesbar":true},"benachrichtigt":[],"original":"Stw TV auf beantragt","aktiv":false},
  {"kuerzel":"AAR","projektform":"NW","scope":"tv","zielStatus":{"roh":"abgelehnt/zurückgezogen","code":73,"aufloesbar":true},"benachrichtigt":["Z1","AAA"],"original":"trigger AZ1, AAA, Stw TV auf abgelehnt/zurückgezogen","aktiv":false},
  {"kuerzel":"AB","projektform":"NW","scope":"tv+verbund","zielStatus":{"roh":"bewilligungseif","code":null,"aufloesbar":false},"benachrichtigt":[],"original":"Stw TV + VB auf bewilligungseif","aktiv":false},
  {"kuerzel":"ABA","projektform":"NW","scope":"tv","zielStatus":{"roh":"abgebrochen","code":90,"aufloesbar":true},"benachrichtigt":["AB","FB"],"original":"trigger  an AB/FB, Stw TV auf abgebrochen","aktiv":false},
  {"kuerzel":"ABA","projektform":"DL","scope":"tv","zielStatus":{"roh":"abgebrochen","code":90,"aufloesbar":true},"benachrichtigt":["AB","FB"],"original":"trigger an AB/FB, Stw TV auf abgebrochen","aktiv":false},
  {"kuerzel":"ABB","projektform":"NW","scope":"tv+verbund","zielStatus":{"roh":"bewilligt","code":59,"aufloesbar":true},"benachrichtigt":["Z1"],"original":"trigger AZ1; Stw TV + VB auf bewilligt","aktiv":false},
  {"kuerzel":"ABLW","projektform":"NW","scope":"tv","zielStatus":{"roh":"Widerspruch zur Ablehnung","code":75,"aufloesbar":true},"benachrichtigt":["AB","FB","zim-pl"],"original":"trigger an AB, FB, zim-pl, Stw TV auf Widerspruch zur Ablehnung","aktiv":false},
  {"kuerzel":"ABLWR","projektform":"NW","scope":"tv","zielStatus":{"roh":"abgelehnt/zurückgezogen","code":73,"aufloesbar":true},"benachrichtigt":["AA","FB","zim-juristen"],"original":"trigger AAA, FB, zim-juristen, Stw TV auf abgelehnt/zurückgezogen","aktiv":false},
  {"kuerzel":"ABLWZ","projektform":"NW","scope":"tv","zielStatus":{"roh":"abgelehnt/zurückgezogen","code":73,"aufloesbar":true},"benachrichtigt":[],"original":"Stw TV auf abgelehnt/zurückgezogen","aktiv":false},
  {"kuerzel":"ABLZ","projektform":"NW","scope":null,"zielStatus":{"roh":"abgelehnt","code":null,"aufloesbar":false},"benachrichtigt":["AB","AZ1","AAA"],"original":"trigger an AB, AZ1, AAA, Stw auf abgelehnt","aktiv":false},
  {"kuerzel":"ABRWZ","projektform":"NW","scope":null,"zielStatus":{"roh":"Anh z Widerruf","code":null,"aufloesbar":false},"benachrichtigt":["AB"],"original":"trigger an AB, Stw auf Anh z Widerruf","aktiv":false},
  {"kuerzel":"ABRWZ2","projektform":"NW","scope":null,"zielStatus":{"roh":"Anh z Widerruf","code":null,"aufloesbar":false},"benachrichtigt":["AB"],"original":"trigger an AB, Stw auf Anh z Widerruf","aktiv":false},
  {"kuerzel":"ABX","projektform":"FuE","scope":"tv","zielStatus":{"roh":"Bewilligungsentwurf","code":null,"aufloesbar":false},"benachrichtigt":[],"original":"Stw TV auf Bewilligungsentwurf","aktiv":false},
  {"kuerzel":"AK4","projektform":"NW","scope":"tv","zielStatus":{"roh":"kaufm. geprüft","code":39,"aufloesbar":true},"bedingung":{"art":"kuerzel-gesetzt","negiert":true,"kuerzel":"AT4","roh":"kein AT4 gesetzt wurde, sonst auf GA fertig"},"benachrichtigt":["FB"],"original":"trigger an FB, Stw TV auf kaufm. geprüft, wenn kein AT4 gesetzt wurde, sonst auf GA fertig","aktiv":false},
  {"kuerzel":"AL","projektform":"NW","scope":"tv","zielStatus":{"roh":"NL eingegangen","code":36,"aufloesbar":true},"bedingung":{"art":"status-vorbedingung","negiert":true,"roh":"noch nicht bewilligt/abgelehnt"},"benachrichtigt":["AB","FB"],"original":"trigger an AB, FB, Stw TV auf NL eingegangen, wenn noch nicht bewilligt/abgelehnt","aktiv":false},
  {"kuerzel":"ALS","projektform":"NW","scope":null,"zielStatus":{"roh":"keine weiteren NF","code":37,"aufloesbar":true},"bedingung":{"art":"kuerzel-gesetzt","negiert":false,"kuerzel":"ALSB","roh":"ALSB gesetzt wurde"},"benachrichtigt":[],"original":"auch setzen, wenn NL okay sind, trigger an AB Stw auf keine weiteren NF, wenn ALSB gesetzt wurde","aktiv":false},
  {"kuerzel":"ALS","projektform":"DL","scope":null,"zielStatus":{"roh":"keine weiteren NF","code":37,"aufloesbar":true},"bedingung":{"art":"kuerzel-gesetzt","negiert":false,"kuerzel":"ALSB","roh":"ALSB gesetzt wurde"},"benachrichtigt":["AB"],"original":"auch setzen, wenn NL okay sind, trigger an AB, Stw auf keine weiteren NF, wenn ALSB gesetzt wurde","aktiv":false},
  {"kuerzel":"ALSB","projektform":"NW","scope":null,"zielStatus":{"roh":"keine weiteren NF","code":37,"aufloesbar":true},"bedingung":{"art":"kuerzel-gesetzt","negiert":false,"kuerzel":"ALS","roh":"ALS gesetzt wurde"},"benachrichtigt":[],"original":"auch setzen, wenn NL okay sind, trigger an FB Stw auf keine weiteren NF, wenn ALS gesetzt wurde","aktiv":false},
  {"kuerzel":"ALSB","projektform":"DL","scope":null,"zielStatus":{"roh":"keine weiteren NF","code":37,"aufloesbar":true},"bedingung":{"art":"kuerzel-gesetzt","negiert":false,"kuerzel":"ALS","roh":"ALS gesetzt wurde"},"benachrichtigt":["FB"],"original":"auch setzen, wenn NL okay sind, trigger an FB, Stw auf keine weiteren NF, wenn ALS gesetzt wurde","aktiv":false},
  {"kuerzel":"AN","projektform":"NW","scope":null,"zielStatus":{"roh":"Nachforderungen gestellt","code":null,"aufloesbar":false},"bedingung":{"art":"status-vorbedingung","negiert":true,"roh":"noch nicht bewilligt"},"benachrichtigt":["AB"],"original":"egal in welcher Form, trigger an AB, Stw auf Nachforderungen gestellt, wenn noch nicht bewilligt","aktiv":false},
  {"kuerzel":"ARW","projektform":"NW","scope":"tv","zielStatus":{"roh":"Stellungnahme RNE eingegangen","code":null,"aufloesbar":false},"benachrichtigt":["AB","FB"],"original":"trigger an AB, FB, Stw TV auf Stellungnahme RNE eingegangen","aktiv":false},
  {"kuerzel":"ARZ","projektform":"NW","scope":"tv","zielStatus":{"roh":"Rücknahmeempfehlung","code":null,"aufloesbar":false},"benachrichtigt":["AZ1","AAA"],"original":"trigger an AZ1, AAA, Stw TV auf Rücknahmeempfehlung","aktiv":false},
  {"kuerzel":"AT4","projektform":"NW","scope":"tv","zielStatus":{"roh":"techn. geprüft","code":38,"aufloesbar":true},"bedingung":{"art":"kuerzel-gesetzt","negiert":true,"kuerzel":"AK4","roh":"kein AK4 gesetzt wurde, sonst auf GA fertig"},"benachrichtigt":["AB"],"original":"trigger an AB, Stw TV auf techn. geprüft, wenn kein AK4 gesetzt wurde, sonst auf GA fertig","aktiv":false},
  {"kuerzel":"PC+","projektform":"FuE","scope":"tv","zielStatus":{"roh":"bearbeitungsreif","code":34,"aufloesbar":true},"benachrichtigt":["FB"],"original":"trigger an FB, Stw TV auf bearbeitungsreif","aktiv":false},
  {"kuerzel":"PC-","projektform":"FuE","scope":"tv","zielStatus":{"roh":"ablehnungsreif","code":32,"aufloesbar":true},"benachrichtigt":["FB"],"original":"trigger an FB, Stw TV auf ablehnungsreif","aktiv":false},
  {"kuerzel":"PC?","projektform":"FuE","scope":"tv","zielStatus":{"roh":"unvollständig","code":33,"aufloesbar":true},"benachrichtigt":["FB"],"original":"trigger an FB, Stw TV auf unvollständig","aktiv":false},
  {"kuerzel":"VBT","projektform":"NW","scope":null,"zielStatus":{"roh":"VN techn geprüft","code":null,"aufloesbar":false},"benachrichtigt":["zim-qs"],"original":"trigger an zim-qs, Stw auf VN techn geprüft","aktiv":false},
  {"kuerzel":"VBT","projektform":"DL","scope":null,"zielStatus":{"roh":"VN techn geprüft","code":null,"aufloesbar":false},"benachrichtigt":["AB"],"original":"trigger an AB, Stw auf VN techn geprüft","aktiv":false},
  {"kuerzel":"VU","projektform":"NW","scope":"tv","zielStatus":{"roh":"beendet","code":91,"aufloesbar":true},"benachrichtigt":[],"original":"Stw TV auf beendet","aktiv":false},
  {"kuerzel":"VV","projektform":"NW","scope":null,"zielStatus":{"roh":"SV (nur bei Vorhaben die bewilligt wurden)","code":null,"aufloesbar":false},"benachrichtigt":[],"original":"Stw auf SV (nur bei Vorhaben die bewilligt wurden)","aktiv":false},
  {"kuerzel":"VZK","projektform":"NW","scope":null,"zielStatus":{"roh":"VN geprüft","code":97,"aufloesbar":true},"benachrichtigt":["zim-qs"],"original":"trigger an zim-qs, Stw auf VN geprüft","aktiv":false},
  {"kuerzel":"WRZ","projektform":"NW","scope":"tv","zielStatus":{"roh":"Widerruf","code":92,"aufloesbar":true},"benachrichtigt":["AB"],"original":"trigger an AB, Stw TV auf Widerruf","aktiv":false},
  {"kuerzel":"XHSP","projektform":"FuE","scope":"verbund","zielStatus":{"roh":"Bewilligungsentwurf","code":null,"aufloesbar":false},"benachrichtigt":[],"original":"Stw Verbund auf Bewilligungsentwurf","aktiv":false},
  {"kuerzel":"XIZ","projektform":"FuE","scope":"tv+verbund","zielStatus":{"roh":"Irrläufer","code":29,"aufloesbar":true},"benachrichtigt":[],"original":"Stw TV und Verbund auf Irrläufer","aktiv":false},
  {"kuerzel":"XKS","projektform":"NW","scope":"tv","zielStatus":{"roh":"GA fertig","code":null,"aufloesbar":false},"benachrichtigt":["AB","FB","zim-qs"],"original":"trigger an AB, FB, zim-qs, Stw TV auf GA fertig","aktiv":false},
  {"kuerzel":"XKS","projektform":"DL","scope":"tv","zielStatus":{"roh":"GA fertig","code":null,"aufloesbar":false},"benachrichtigt":["FB","zim-qs"],"original":"trigger an FB, zim-qs, Stw TV auf GA fertig","aktiv":false},
  {"kuerzel":"XPC+","projektform":"FuE","scope":"tv","zielStatus":{"roh":"bearbeitungsreif","code":34,"aufloesbar":true},"bedingung":{"art":"aggregation-tv","quantor":"alle","kuerzel":"PC+","roh":"alle TV PC+ haben"},"benachrichtigt":["AB"],"original":"trigger an AB, Stw TV auf bearbeitungsreif, wenn alle TV PC+ haben","aktiv":false},
  {"kuerzel":"XPC-","projektform":"FuE","scope":"tv","zielStatus":{"roh":"ablehnungsreif","code":32,"aufloesbar":true},"benachrichtigt":["AN"],"original":"trigger an AN, Stw TV auf ablehnungsreif","aktiv":false},
  {"kuerzel":"XPC?","projektform":"FuE","scope":"tv","zielStatus":{"roh":"unvollständig","code":33,"aufloesbar":true},"bedingung":{"art":"aggregation-tv","quantor":"kein","kuerzel":"PC-","roh":"kein TV PC- hat"},"benachrichtigt":["AB"],"original":"trigger an AB, Stw TV auf unvollständig, wenn kein TV PC- hat","aktiv":false},
  {"kuerzel":"XVE","projektform":"FuE","scope":"verbund","zielStatus":{"roh":"beendet","code":91,"aufloesbar":true},"benachrichtigt":[],"original":"automatisch nach Abfrage, Stw Verbund auf beendet","aktiv":false},
  {"kuerzel":"YIRR","projektform":"FuE","scope":"tv","zielStatus":{"roh":"Irrläuder","code":null,"aufloesbar":false},"benachrichtigt":[],"original":"Stw TV auf Irrläuder","aktiv":false},
];
