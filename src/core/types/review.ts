export interface ReviewReply {
  id: string;
  author: string;
  timestamp: string;
  text: string;
}

export interface ReviewComment {
  id: string;
  documentId: string;
  author: string;
  timestamp: string;
  text: string;
  anchor: {
    from: number;
    to: number;
    quotedText: string;
    orphaned?: boolean;
  };
  status: 'open' | 'resolved';
  replies: ReviewReply[];
}

export interface ReviewSession {
  documentId: string;
  comments: ReviewComment[];
  created: string;
  lastUpdated: string;
}
