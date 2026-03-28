import DiffMatchPatch from 'diff-match-patch';
import type { StorageService } from '@/core/services/storage';
import type { ReviewSession, ReviewComment, ReviewReply } from '@/core/types/review';

const dmp = new DiffMatchPatch();

export class ReviewService {
  async loadReviews(documentId: string, storage: StorageService): Promise<ReviewSession | null> {
    return storage.idb.get<ReviewSession>(`reviews:${documentId}`);
  }

  async saveReviews(documentId: string, session: ReviewSession, storage: StorageService): Promise<void> {
    session.lastUpdated = new Date().toISOString();
    await storage.idb.set(`reviews:${documentId}`, session);
  }

  addComment(session: ReviewSession | null, comment: Omit<ReviewComment, 'id' | 'timestamp' | 'status' | 'replies'>): ReviewSession {
    const s = session ?? { documentId: comment.documentId, comments: [], created: new Date().toISOString(), lastUpdated: '' };
    const full: ReviewComment = {
      ...comment,
      id: `rc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'open',
      replies: [],
    };
    s.comments.unshift(full);
    return s;
  }

  addReply(session: ReviewSession, commentId: string, reply: Omit<ReviewReply, 'id' | 'timestamp'>): ReviewSession {
    const comment = session.comments.find(c => c.id === commentId);
    if (comment) {
      comment.replies.push({
        ...reply,
        id: `rr-${Date.now()}`,
        timestamp: new Date().toISOString(),
      });
    }
    return { ...session };
  }

  resolveComment(session: ReviewSession, commentId: string): ReviewSession {
    const comment = session.comments.find(c => c.id === commentId);
    if (comment) comment.status = 'resolved';
    return { ...session };
  }

  reopenComment(session: ReviewSession, commentId: string): ReviewSession {
    const comment = session.comments.find(c => c.id === commentId);
    if (comment) comment.status = 'open';
    return { ...session };
  }

  reanchorComments(session: ReviewSession, _oldText: string, newText: string): ReviewSession {
    for (const comment of session.comments) {
      const idx = dmp.match_main(newText, comment.anchor.quotedText, comment.anchor.from);
      if (idx === -1) {
        comment.anchor.orphaned = true;
      } else {
        comment.anchor.from = idx;
        comment.anchor.to = idx + comment.anchor.quotedText.length;
        comment.anchor.orphaned = false;
      }
    }
    return { ...session };
  }

  getOpenCount(session: ReviewSession | null): number {
    return session?.comments.filter(c => c.status === 'open').length ?? 0;
  }
}

export const reviewService = new ReviewService();
