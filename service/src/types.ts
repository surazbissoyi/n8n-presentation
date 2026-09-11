export interface SlideOutline {
  title: string;
  bullets: string[];
  speakerNotes?: string;
}

export interface PresentationOutline {
  title: string;
  slides: SlideOutline[];
}

export interface GenerateRequest {
  content: string;
  instructions?: string;
  n_slides?: number;
  tone?: "default" | "casual" | "professional" | "funny" | "educational" | "sales_pitch";
  language?: string;
}

export interface GenerateResponse {
  presentation_id: string;
  title: string;
  slide_count: number;
  download_url: string;
}
