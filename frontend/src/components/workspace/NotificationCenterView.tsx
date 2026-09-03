import React, { useState, useMemo } from "react";
import {
  Bell, CheckCircle2, Trash2, Search, CheckCheck, Clock,
  FolderKanban, Sparkles, MessageSquare, ShieldCheck, Layers, X,
  ExternalLink
} from "lucide-react";

interface NotificationCenterViewProps {
  myNotifications: any[];
  readNotifIds: string[];
  completedNotifIds: string[];
  markNotifAsRead: (id: string) => void;
  markAllNotifsAsRead: () => void;
  completeTaskAndNotifyAuthor: (notif: any, e: React.MouseEvent) => void;
  deleteNotification: (id: string, e: React.MouseEvent) => void;
  clearAllNotifications: (e?: React.MouseEvent) => void;
  onNavigateToItem: (notif: any) => void;
}

export function NotificationCenterView({
  myNotifications,
  readNotifIds,
  completedNotifIds,
  markNotifAsRead,
  markAllNotifsAsRead,
  completeTaskAndNotifyAuthor,
  deleteNotification,
  clearAllNotifications,
  onNavigateToItem,
}: NotificationCenterViewProps) {
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "tasks" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unreadCount = useMemo(() => {
    return myNotifications.filter((n) => n.id && !readNotifIds.includes(n.id) && !completedNotifIds.includes(n.id)).length;
  }, [myNotifications, readNotifIds, completedNotifIds]);

  const completedCount = useMemo(() => {
    return myNotifications.filter((n) => n.id && completedNotifIds.includes(n.id)).length;
  }, [myNotifications, completedNotifIds]);

  const taskCount = useMemo(() => {
    return myNotifications.filter((n) => !n.isCompletionNotif && (!n.id || !completedNotifIds.includes(n.id))).length;
  }, [myNotifications, completedNotifIds]);

  // Filtered Notifications based on Tab & Search
  const filteredNotifications = useMemo(() => {
    return myNotifications.filter((n) => {
      const isCompleted = Boolean(n.id && completedNotifIds.includes(n.id));
      const isUnread = Boolean(n.id && !readNotifIds.includes(n.id) && !isCompleted);

      if (activeTab === "unread" && (!isUnread || isCompleted)) return false;
      if (activeTab === "completed" && !isCompleted) return false;
      if (activeTab === "tasks" && (n.isCompletionNotif || isCompleted)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = (n.text || "").toLowerCase().includes(q);
        const matchAuthor = (n.authorName || "").toLowerCase().includes(q);
        const matchTarget = (n.targetName || "").toLowerCase().includes(q);
        const matchProject = (n.projectName || "").toLowerCase().includes(q);
        const matchType = (n.targetType || "").toLowerCase().includes(q);
        return matchText || matchAuthor || matchTarget || matchProject || matchType;
      }

      return true;
    });
  }, [myNotifications, activeTab, searchQuery, readNotifIds, completedNotifIds]);

  return (
    <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full font-sans">
      {/* Breadcrumbs & Page Header */}
      <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
        <div className="flex flex-col gap-1 w-full">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">SYSTEM &gt; NOTIFICATIONS</span>
          <div className="flex items-center justify-between mt-0.5 flex-wrap gap-2">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Notification Center</h1>
              <span className="text-[15px] font-semibold text-muted-foreground">{myNotifications.length} items</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotifsAsRead}
                  className="h-8.5 px-3.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground font-bold border border-border text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCheck className="size-3.5 text-primary" />
                  <span>Mark All Read</span>
                </button>
              )}
              {myNotifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="h-8.5 px-3.5 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive font-bold border border-destructive/20 text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Manage, track, and resolve coordination comments and project tasks across workspaces.
          </p>
        </div>
      </div>

      {/* Main White Card Container (Matching Ventilation, Preliminary, & Sprinkler standard) */}
      <div className="flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-300">
        
        {/* Top Section: 4 Stat KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 p-4 border-b border-border/60 bg-surface-2/15 shrink-0 select-none">
          <div className="bg-background border border-border rounded-xl p-3 flex items-center justify-between shadow-2xs hover:border-primary/40 transition-all">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Items</span>
              <div className="text-[20px] font-black text-foreground font-mono mt-0.5">{myNotifications.length}</div>
            </div>
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
              <Bell className="size-4.5" />
            </div>
          </div>

          <div className="bg-background border border-border rounded-xl p-3 flex items-center justify-between shadow-2xs hover:border-primary/40 transition-all">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Unread</span>
              <div className="text-[20px] font-black text-primary font-mono mt-0.5">{unreadCount}</div>
            </div>
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary relative border border-primary/20 shrink-0">
              <Sparkles className="size-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 animate-pulse border-2 border-background" />
              )}
            </div>
          </div>

          <div className="bg-background border border-border rounded-xl p-3 flex items-center justify-between shadow-2xs hover:border-amber-500/40 transition-all">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Tasks</span>
              <div className="text-[20px] font-black text-amber-500 font-mono mt-0.5">{taskCount}</div>
            </div>
            <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shrink-0">
              <MessageSquare className="size-4.5" />
            </div>
          </div>

          <div className="bg-background border border-border rounded-xl p-3 flex items-center justify-between shadow-2xs hover:border-emerald-500/40 transition-all">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completed</span>
              <div className="text-[20px] font-black text-emerald-500 font-mono mt-0.5">{completedCount}</div>
            </div>
            <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
              <CheckCircle2 className="size-4.5" />
            </div>
          </div>
        </div>

        {/* Toolbar Row: Tab Pill Switchers + Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 bg-card shrink-0 select-none">
          <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80 self-start">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({myNotifications.length})
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                activeTab === "unread"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                activeTab === "tasks"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tasks ({taskCount})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                activeTab === "completed"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>

          <div className="relative flex-1 max-w-full sm:max-w-xs md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by author, space, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 h-8.5 bg-surface-2 border border-border/80 rounded-xl text-[12px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Notifications List Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="w-full bg-background border border-border/80 rounded-2xl p-12 text-center shadow-2xs">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 border border-primary/20">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-[15px] font-bold text-foreground">No Notifications Found</h3>
              <p className="text-[12px] text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
                {searchQuery
                  ? `No notifications matched "${searchQuery}".`
                  : activeTab === "unread"
                  ? "You have read all your notifications!"
                  : activeTab === "completed"
                  ? "No completed tasks yet."
                  : "You don't have any notifications at the moment."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif, index) => {
              const isCompleted = Boolean(notif.id && completedNotifIds.includes(notif.id));
              const isUnread = Boolean(notif.id && !readNotifIds.includes(notif.id) && !isCompleted);

              const rawText = notif.text || notif.message || notif.metadata?.text || "";
              const rawAuthor = notif.authorName || notif.metadata?.authorName || "Design Engineer";
              const rawTargetType = notif.targetType || notif.metadata?.targetType || "Location";
              const rawTargetName = notif.targetName || notif.metadata?.targetName || notif.targetId || "";
              const rawProjectName = notif.projectName || notif.metadata?.projectName || "Active Project";
              const rawDate = notif.timestamp || notif.metadata?.createdAt || notif.createdAt || "";

              const dateObj = new Date(rawDate);
              const formattedDate = (!rawDate || isNaN(dateObj.getTime()))
                ? (rawDate || "Just now")
                : `${dateObj.toLocaleDateString()}, ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;

              return (
                <div
                  key={notif.id || index}
                  onClick={() => {
                    if (notif.id) markNotifAsRead(notif.id);
                    onNavigateToItem(notif);
                  }}
                  className={`w-full p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left relative overflow-hidden group shadow-2xs ${
                    isCompleted
                      ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                      : isUnread
                      ? "bg-background border-primary/40 shadow-xs hover:border-primary hover:shadow-sm ring-1 ring-primary/10"
                      : "bg-background/80 border-border/80 hover:border-primary/30 hover:bg-background"
                  }`}
                >
                  {isUnread && (
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary" />
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div
                        className={`size-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                          isCompleted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : notif.isCompletionNotif
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : isUnread
                            ? "bg-primary/10 text-primary border-primary/25"
                            : "bg-surface-2 text-muted-foreground border-border"
                        }`}
                      >
                        {isCompleted || notif.isCompletionNotif ? (
                          <CheckCircle2 className="size-4.5 text-emerald-500" />
                        ) : (
                          <MessageSquare className="size-4.5 text-primary" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-[13.5px] text-foreground">
                            {rawAuthor}
                          </span>

                          {isUnread && (
                            <span className="px-2 py-0.2 bg-primary/15 text-primary text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-primary/20">
                              NEW
                            </span>
                          )}

                          {isCompleted && (
                            <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-emerald-500/30">
                              DONE
                            </span>
                          )}

                          <span className="text-[11px] text-muted-foreground font-medium ml-auto flex items-center gap-1 shrink-0">
                            <Clock className="size-3 text-muted-foreground/70" />
                            {formattedDate}
                          </span>
                        </div>

                        {/* Comment Message */}
                        {rawText && (
                          <p className={`text-[12.5px] font-medium text-foreground/90 leading-relaxed mb-2.5 text-left break-words ${
                            isCompleted ? "line-through text-muted-foreground/70" : ""
                          }`}>
                            {rawText}
                          </p>
                        )}

                        {/* Location & Project Pills */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                          {rawTargetType && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary font-extrabold rounded-md text-[9.5px] uppercase tracking-wider flex items-center gap-1 border border-primary/20">
                              <Layers className="size-3" />
                              {rawTargetType}
                            </span>
                          )}

                          {rawTargetName && (
                            <span className={`text-foreground/90 font-bold truncate max-w-[240px] ${isCompleted ? "line-through" : ""}`}>
                              {rawTargetName}
                            </span>
                          )}

                          {rawProjectName && (
                            <>
                              <span className="text-muted-foreground/70 text-[11px]">in</span>
                              <span className="font-bold text-primary truncate max-w-[220px] flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/15" title={rawProjectName}>
                                <FolderKanban className="size-3 text-primary/80" />
                                {rawProjectName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Action Control Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      {!notif.isCompletionNotif && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            completeTaskAndNotifyAuthor(notif, e);
                          }}
                          disabled={isCompleted}
                          className={`h-8 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[11.5px] font-bold border ${
                            isCompleted
                              ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30 cursor-default opacity-80"
                              : "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          }`}
                          title={isCompleted ? "Task Completed" : "Mark task as completed"}
                        >
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          <span>{isCompleted ? "Done" : "Mark Done"}</span>
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id, e);
                        }}
                        className="p-1.5 text-muted-foreground/70 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-lg transition-all cursor-pointer"
                        title="Delete notification"
                      >
                        <Trash2 className="size-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (notif.id) markNotifAsRead(notif.id);
                          onNavigateToItem(notif);
                        }}
                        className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/95 border border-primary/20 rounded-lg transition-all flex items-center gap-1 text-[11.5px] font-bold cursor-pointer shadow-2xs"
                        title="View item in calculator"
                      >
                        <span>View</span>
                        <ExternalLink className="size-3 text-primary-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
