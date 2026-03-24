import { z } from "zod";

/** Single UUID param — :id for content, booking, project, calendar */
export const IdParam = z.object({ id: z.string().uuid() });

/** Creator identifier — UUID or handle slug */
export const CreatorIdParam = z.object({ creatorId: z.string().min(1) });

/** Content by creator — dual slug resolution */
export const ContentByCreatorParams = z.object({
  creatorIdentifier: z.string().min(1),
  contentIdentifier: z.string().min(1),
});

/** Merch product handle */
export const HandleParam = z.object({ handle: z.string().min(1) });

/** Admin user target */
export const UserIdParam = z.object({ userId: z.string().uuid() });

/** Creator + member compound param */
export const CreatorMemberParams = z.object({
  creatorId: z.string().min(1),
  memberId: z.string().min(1),
});

/** Creator + event compound param */
export const CreatorEventParams = z.object({
  creatorId: z.string().min(1),
  eventId: z.string().min(1),
});

/** Multipart upload ID */
export const UploadIdParam = z.object({ uploadId: z.string().min(1) });

/** Multipart upload part — uploadId + partNumber */
export const UploadPartParams = z.object({
  uploadId: z.string().min(1),
  partNumber: z.string().regex(/^\d+$/),
});
