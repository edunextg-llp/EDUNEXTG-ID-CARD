ALTER TABLE `users` MODIFY COLUMN `role` enum('SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER','PARTNER','PARTNER_ADMIN','MARKETING_ADMIN') NOT NULL DEFAULT 'VIEWER';--> statement-breakpoint
ALTER TABLE `schools` ADD `createdByUserId` int;--> statement-breakpoint
ALTER TABLE `schools` ADD CONSTRAINT `schools_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `schools_createdByUserId_idx` ON `schools` (`createdByUserId`);