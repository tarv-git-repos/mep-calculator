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
    <div className="w-full flex-1 p-6 md:p-8 space-y-5 overflow-y-auto custom-scrollbar h-full bg-slate-50/50 dark:bg-zinc-950/20 font-sans">
      {/* Top Banner Header */}
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60 select-none">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs shrink-0">
            <Bell className="size-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-[20px] font-black text-foreground tracking-tight">
              Notification Center
            </h1>
            <p className="text-[12.5px] text-muted-foreground font-semibold mt-0.5">
              Manage, track, and resolve coordination comments and project tasks across workspaces.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={markAllNotifsAsRead}
              className="h-8.5 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground font-bold border border-border text-[11.5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <CheckCheck className="size-3.5 text-primary" />
              <span>Mark All Read</span>
            </button>
          )}
          {myNotifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="h-8.5 px-3 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive font-bold border border-destructive/20 text-[11.5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Standardized Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full select-none">
        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-primary/40 transition-all w-full">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</span>
            <div className="text-[22px] font-black text-foreground font-mono mt-0.5">{myNotifications.length}</div>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <Bell className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-primary/40 transition-all w-full">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Unread</span>
            <div className="text-[22px] font-black text-primary font-mono mt-0.5">{unreadCount}</div>
          </div>
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary relative border border-primary/20 shrink-0">
            <Sparkles className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 size-3 rounded-full bg-red-500 animate-pulse border-2 border-background" />
            )}
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-amber-500/40 transition-all w-full">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tasks</span>
            <div className="text-[22px] font-black text-amber-500 font-mono mt-0.5">{taskCount}</div>
          </div>
          <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shrink-0">
            <MessageSquare className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:border-emerald-500/40 transition-all w-full">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Completed</span>
            <div className="text-[22px] font-black text-emerald-500 font-mono mt-0.5">{completedCount}</div>
          </div>
          <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/80 p-2 rounded-2xl shadow-xs select-none">
        <div className="flex items-center gap-1 overflow-x-auto p-0.5">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            All ({myNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab("unread")}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "unread"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === "unread" ? "bg-white text-primary" : "bg-primary text-white"
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tasks"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            Tasks & Comments ({taskCount})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "completed"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
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
            className="w-full pl-9 pr-8 h-9 bg-surface-2 border border-border/80 rounded-xl text-[12px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
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

      {/* Notifications Feed */}
      {filteredNotifications.length === 0 ? (
        <div className="w-full bg-card border border-border/80 rounded-2xl p-12 text-center shadow-xs">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 border border-primary/20">
            <ShieldCheck className="size-7" />
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
        <div className="w-full space-y-3">
          {filteredNotifications.map((notif, index) => {
            const isUnread = notif.id && !readNotifIds.includes(notif.id);
            const isCompleted = notif.id && completedNotifIds.includes(notif.id);
            const formattedDate = isNaN(new Date(notif.timestamp).getTime())
              ? notif.timestamp
              : `${new Date(notif.timestamp).toLocaleDateString()}, ${new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;

            return (
              <div
                key={notif.id || index}
                onClick={() => {
                  if (notif.id) markNotifAsRead(notif.id);
                  onNavigateToItem(notif);
                }}
                className={`w-full group relative border rounded-2xl p-4 sm:p-4.5 transition-all duration-150 cursor-pointer shadow-xs ${
                  isCompleted
                    ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 opacity-80"
                    : isUnread
                    ? "bg-card border-primary/50 shadow-xs ring-1 ring-primary/20"
                    : "bg-card border-border/80 hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left Avatar & Content */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 w-full min-w-0">
                    <div className="relative shrink-0">
                      <div className="size-10 rounded-xl bg-primary/10 border border-primary/25 text-primary font-extrabold text-[13px] flex items-center justify-center shadow-xs">
                        {notif.authorName?.slice(0, 2)?.toUpperCase() || "ME"}
                      </div>
                      {isUnread && !isCompleted && (
                        <span className="absolute -top-1 -right-1 size-3 rounded-full bg-primary ring-2 ring-background shadow-xs" title="Unread" />
                      )}
                      {isCompleted && (
                        <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-background text-[9.5px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="flex-1 w-full min-w-0">
                      {/* Author Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[13.5px] font-bold text-foreground truncate ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {notif.authorName}
                        </span>

                        {isUnread && !isCompleted && (
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
                      <p className={`text-[12.5px] font-medium text-foreground/90 leading-relaxed mb-2.5 text-left break-words ${
                        isCompleted ? "line-through text-muted-foreground/70" : ""
                      }`}>
                        {notif.text}
                      </p>

                      {/* Location & Project Pills */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary font-extrabold rounded-md text-[9.5px] uppercase tracking-wider flex items-center gap-1 border border-primary/20">
                          <Layers className="size-3" />
                          {notif.targetType}
                        </span>

                        <span className={`text-foreground/90 font-bold truncate max-w-[240px] ${isCompleted ? "line-through" : ""}`}>
                          {notif.targetName}
                        </span>

                        <span className="text-muted-foreground/70 text-[11px]">in</span>

                        <span className="font-bold text-primary truncate max-w-[220px] flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/15" title={notif.projectName}>
                          <FolderKanban className="size-3 text-primary/80" />
                          {notif.projectName}
                        </span>
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
          })}
        </div>
      )}
    </div>
  );
}
