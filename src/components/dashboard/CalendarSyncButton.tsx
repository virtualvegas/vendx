import { useState } from "react";
import { Apple, CalendarDays, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const CalendarSyncButton = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");

  const makeFeedUrl = (token: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/calendar-feed?token=${token}`;
  };

  const loadFeed = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_calendar_feed");
    setLoading(false);
    if (error) {
      toast.error("Calendar sync is only available to employee accounts");
      return;
    }
    setFeedUrl(makeFeedUrl(data));
  };

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !feedUrl && !loading) void loadFeed();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    toast.success("Private calendar link copied");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const rotateLink = async () => {
    if (!window.confirm("Create a new calendar link? Your old Apple or Google subscription will stop updating until you subscribe with the new link.")) return;
    setRotating(true);
    const { data, error } = await supabase.rpc("rotate_my_calendar_feed");
    setRotating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFeedUrl(makeFeedUrl(data));
    toast.success("New private link created. Subscribe again in your calendar app.");
  };

  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
  const appleUrl = feedUrl.replace(/^https:/, "webcal:");

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => changeOpen(true)} className="gap-2">
        <CalendarDays className="h-4 w-4" />
        <span className="hidden sm:inline">Calendar sync</span>
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Sync my service calendar</DialogTitle>
            <DialogDescription>
              Your assigned route stops, external-service tickets and recurring visits, together in one calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium">VendX updates your calendar automatically</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Edit work in VendX, not in your calendar. Apple and Google check this feed for changes; Google may take several hours to refresh.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Preparing your private feed…
              </div>
            ) : feedUrl ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild className="gap-2">
                    <a href={appleUrl}>
                      <Apple className="h-4 w-4" /> Add to Apple Calendar
                    </a>
                  </Button>
                  <Button asChild variant="secondary" className="gap-2">
                    <a href={googleUrl} target="_blank" rel="noreferrer">
                      <CalendarDays className="h-4 w-4" /> Add to Google Calendar <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>

                <div className="space-y-2">
                  <label htmlFor="calendar-feed-url" className="text-xs font-medium">Private subscription link</label>
                  <div className="flex gap-2">
                    <Input id="calendar-feed-url" readOnly value={feedUrl} className="text-xs" onFocus={(event) => event.target.select()} />
                    <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy calendar link">
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Anyone with this link can see your assigned schedule. Keep it private.</p>
                </div>

                <div className="flex items-center justify-between gap-3 border-t pt-4">
                  <p className="text-xs text-muted-foreground">Shared the link by mistake?</p>
                  <Button variant="ghost" size="sm" onClick={rotateLink} disabled={rotating} className="shrink-0">
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} /> Create new link
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={loadFeed} variant="outline" className="w-full">Try again</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CalendarSyncButton;
