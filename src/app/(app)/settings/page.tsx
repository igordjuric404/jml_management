"use client";

import { useState, useEffect } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const intervalOptions = [
  { value: "hourly", label: "Hourly" },
  { value: "every_6_hours", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const remediationOptions = [
  { value: "full_bundle", label: "Full Remediation Bundle" },
  { value: "revoke_tokens", label: "Revoke OAuth Tokens Only" },
  { value: "delete_asps", label: "Delete ASPs Only" },
  { value: "sign_out", label: "Sign Out User" },
];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [form, setForm] = useState<Partial<{
    auto_scan_on_offboard: boolean;
    auto_remediate_on_offboard: boolean;
    background_scan_enabled: boolean;
    auto_create_case_on_leave: boolean;
    background_scan_interval: string;
    remediation_check_interval: string;
    notify_on_new_findings: boolean;
    notify_on_remediation: boolean;
    notification_email: string;
    default_remediation_action: string;
  }>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        auto_scan_on_offboard: settings.auto_scan_on_offboard,
        auto_remediate_on_offboard: settings.auto_remediate_on_offboard,
        background_scan_enabled: settings.background_scan_enabled,
        auto_create_case_on_leave: settings.auto_create_case_on_leave,
        background_scan_interval: settings.background_scan_interval,
        remediation_check_interval: settings.remediation_check_interval,
        notify_on_new_findings: settings.notify_on_new_findings,
        notify_on_remediation: settings.notify_on_remediation,
        notification_email: settings.notification_email ?? "",
        default_remediation_action: settings.default_remediation_action,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(form);
  };

  const setBool = (key: keyof typeof form, value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setStr = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">OGM Settings</h1>
        <p className="text-muted-foreground">
          Configure automation, scanning, and remediation behavior
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation Toggles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto_scan">Auto scan on offboard</Label>
            <Checkbox
              id="auto_scan"
              checked={form.auto_scan_on_offboard ?? false}
              onCheckedChange={(v) =>
                setBool("auto_scan_on_offboard", !!v)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto_remediate">Auto remediate on offboard</Label>
            <Checkbox
              id="auto_remediate"
              checked={form.auto_remediate_on_offboard ?? false}
              onCheckedChange={(v) =>
                setBool("auto_remediate_on_offboard", !!v)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="background_scan">Background scan enabled</Label>
            <Checkbox
              id="background_scan"
              checked={form.background_scan_enabled ?? false}
              onCheckedChange={(v) =>
                setBool("background_scan_enabled", !!v)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto_create_case">Auto create case on leave</Label>
            <Checkbox
              id="auto_create_case"
              checked={form.auto_create_case_on_leave ?? false}
              onCheckedChange={(v) =>
                setBool("auto_create_case_on_leave", !!v)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan & Remediation Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Background scan interval</Label>
            <Select
              value={form.background_scan_interval ?? "hourly"}
              onValueChange={(v) => setStr("background_scan_interval", v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Remediation check interval</Label>
            <Select
              value={form.remediation_check_interval ?? "hourly"}
              onValueChange={(v) => setStr("remediation_check_interval", v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default remediation action</Label>
            <Select
              value={form.default_remediation_action ?? "full_bundle"}
              onValueChange={(v) => setStr("default_remediation_action", v)}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {remediationOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notify_findings">Notify on new findings</Label>
            <Checkbox
              id="notify_findings"
              checked={form.notify_on_new_findings ?? false}
              onCheckedChange={(v) =>
                setBool("notify_on_new_findings", !!v)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notify_remediation">Notify on remediation</Label>
            <Checkbox
              id="notify_remediation"
              checked={form.notify_on_remediation ?? false}
              onCheckedChange={(v) =>
                setBool("notify_on_remediation", !!v)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notification_email">Notification email</Label>
            <Input
              id="notification_email"
              type="email"
              value={form.notification_email ?? ""}
              onChange={(e) =>
                setStr("notification_email", e.target.value)
              }
              placeholder="admin@example.com"
              className="max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save
        </Button>
      </div>
    </div>
  );
}
