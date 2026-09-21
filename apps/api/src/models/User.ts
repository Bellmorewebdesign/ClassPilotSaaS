import mongoose from 'mongoose';
import type { HydratedDocument, Model } from 'mongoose';

/**
 * Mongoose ships as CommonJS, so ESM named value imports of its runtime
 * exports (`models` in particular) are not reliably available. The default
 * import is destructured instead; type-only names still import normally.
 */
const { Schema, model, models } = mongoose;

/**
 * A ClassPilot user.
 *
 * V1 runs in development-user mode: one user is provisioned at boot from
 * environment config. The schema is nonetheless shaped for real multi-tenancy
 * from day one — every other collection carries a `userId` that points here.
 */
export interface UserAttrs {
  email: string;
  displayName: string | null;
  /** How this user is authenticated today. Lets us migrate users later. */
  authMode: 'dev' | 'production';
  createdAt: Date;
  updatedAt: Date;
}

export type UserDoc = HydratedDocument<UserAttrs>;

const userSchema = new Schema<UserAttrs>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 320,
    },
    displayName: { type: String, default: null, trim: true, maxlength: 200 },
    authMode: {
      type: String,
      required: true,
      enum: ['dev', 'production'],
      default: 'dev',
    },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ email: 1 }, { unique: true });

export const User: Model<UserAttrs> =
  (models.User as Model<UserAttrs>) ?? model<UserAttrs>('User', userSchema);
