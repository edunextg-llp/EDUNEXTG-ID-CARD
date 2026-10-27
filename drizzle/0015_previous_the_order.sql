ALTER TABLE `users` MODIFY COLUMN `avatarUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `users` ADD `idPass` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_idx` UNIQUE(`email`);