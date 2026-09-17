CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"metric" varchar(64) NOT NULL,
	"threshold" real NOT NULL,
	"condition" varchar(8) NOT NULL,
	"window_minutes" integer DEFAULT 5 NOT NULL,
	"cooldown_minutes" integer DEFAULT 15 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"title" varchar(255) NOT NULL,
	"trigger_value" real NOT NULL,
	"notes" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_rules_project_id_idx" ON "alert_rules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "incidents_project_id_idx" ON "incidents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "incidents_alert_rule_id_idx" ON "incidents" USING btree ("alert_rule_id");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_opened_at_idx" ON "incidents" USING btree ("opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_one_open_per_rule_idx" ON "incidents" USING btree ("alert_rule_id") WHERE "incidents"."status" = 'open';