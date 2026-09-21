import mongoose from 'mongoose';
import type { HydratedDocument, Model, Types } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports (`models` in particular) are not reliably available. The default
 * import is destructured instead; type-only names still import normally.
 */
const { Schema, model, models } = mongoose;

/**
 * A bearer token the Chrome extension presents to the API.
 *
 * Only the SHA-256 hash of the token is stored, so a database dump does not
 * hand an attacker working credentials. `lastFourChars` exists purely so the
 * dashboard can say "the token ending in a1b2" without revealing the secret.
 *
 * This collection is the seam where real SaaS auth will slot in: replace the
 * resolver in plugins/auth.ts and the rest of the API is unchanged.
 */
export interface ExtensionTokenAttrs {
  userId: Types.ObjectId;
  /** SHA-256 hex digest of the raw token. Never the token itself. */
  tokenHash: string;
  label: string;
  lastFourChars: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ExtensionTokenDoc = HydratedDocument<ExtensionTokenAttrs>;

const extensionTokenSchema = new Schema<ExtensionTokenAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, maxlength: 64 },
    label: { type: String, required: true, default: 'dev', maxlength: 100 },
    lastFourChars: { type: String, required: true, maxlength: 8 },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'extension_tokens' },
);

extensionTokenSchema.index({ tokenHash: 1 }, { unique: true });
extensionTokenSchema.index({ userId: 1 });

export const ExtensionToken: Model<ExtensionTokenAttrs> =
  (models.ExtensionToken as Model<ExtensionTokenAttrs>) ??
  model<ExtensionTokenAttrs>('ExtensionToken', extensionTokenSchema);
