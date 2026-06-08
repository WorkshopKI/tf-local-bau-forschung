// Kurator-Anzeige der beigefügten Screenshots eines Tickets (v2.42). Seit v2.46
// nur noch ein dünner Re-Export der geteilten Komponente FeedbackScreenshots
// (gemeinsam mit dem öffentlichen Board genutzt) — eine einzige Implementierung
// für Laden (readSharedAttachment) + Thumbnails + Lightbox.

export { FeedbackScreenshots as TicketScreenshots } from '@/components/feedback/FeedbackScreenshots';
