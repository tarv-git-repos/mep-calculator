import React, { useState, useMemo } from "react";
import {
  Bell, CheckCircle2, Trash2, Search, CheckCheck, Clock,
  FolderKanban, Sparkles, MessageSquare, ShieldCheck, Layers, X,
  ExternalLink, RotateCcw, Inbox, AlertCircle, Check, ArrowRight, MoveRight
} from "lucide-react";

interface NotificationCenterViewProps {
  myNotifications: any[];
  deletedNotifications?: any[];
  readNotifIds: string[];
  completedNotifIds: string[];
  deletedNotifIds?: string[];
  markNotifAsRead: (id: string) => void;
  markAllNotifsAsRead: () => void;
  completeTaskAndNotifyAuthor: (notif: any, e: React.MouseEvent) => void;
  deleteNotification: (idOrNotif: any, e?: React.MouseEvent) => void;
  restoreNotification?: (idOrNotif: any, e?: React.MouseEvent) => void;
  permanentlyDeleteNotification?: (idOrNotif: any, e?: React.MouseEvent) => void;
  clearAllReceivedNotifications?: (e?: React.MouseEvent) => void;
  clearAllCompletedNotifications?: (e?: React.MouseEvent) => void;
  clearAllDeletedNotifications?: (e?: React.MouseEvent) => void;
  restoreAllDeletedNotifications?: (e?: React.MouseEvent) => void;
  clearAllNotifications?: (e?: React.MouseEvent) => void;
  onNavigateToItem: (notif: any) => void;
}

export function NotificationCenterView({
  myNotifications = [],
  deletedNotifications = [],
  readNotifIds = [],
  completedNotifIds = [],
  deletedNotifIds = [],
  markNotifAsRead,
  markAllNotifsAsRead,
  completeTaskAndNotifyAuthor,
  deleteNotification,
  restoreNotification,
  permanentlyDeleteNotification,
  clearAllReceivedNotifications,
  clearAllCompletedNotifications,
  clearAllDeletedNotifications,
  restoreAllDeletedNotifications,
  clearAllNotifications,
  onNavigateToItem,
}: NotificationCenterViewProps) {
  const [activeTab, setActiveTab] = useState<"received" | "completed" | "deleted">("received");
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Received Notifications: active, not completed, not deleted
  const receivedNotifications = useMemo(() => {
    return myNotifications.filter((n) => {
      if (!n || !n.id) return false;
      const isDeleted = Boolean(n.deleted || deletedNotifIds.includes(n.id) || (n.text && deletedNotifIds.includes(n.text)));
      const isCompleted = Boolean(n.completed || completedNotifIds.includes(n.id) || (n.text && completedNotifIds.includes(n.text)));
      return !isDeleted && !isCompleted;
    });
  }, [myNotifications, deletedNotifIds, completedNotifIds]);

  // 2. Completed Notifications: completed, not deleted
  const completedNotifications = useMemo(() => {
    return myNotifications.filter((n) => {
      if (!n || !n.id) return false;
      const isDeleted = Boolean(n.deleted || deletedNotifIds.includes(n.id) || (n.text && deletedNotifIds.includes(n.text)));
      const isCompleted = Boolean(n.completed || completedNotifIds.includes(n.id) || (n.text && completedNotifIds.includes(n.text)));
      return !isDeleted && isCompleted;
    });
  }, [myNotifications, deletedNotifIds, completedNotifIds]);

  // 3. Deleted Notifications: merged list of deleted items
  const allDeletedNotifications = useMemo(() => {
    const map = new Map<string, any>();
    
    // Explicitly stored deleted notifications
    (deletedNotifications || []).forEach((n) => {
      if (n && (n.id || n.text)) {
        const key = n.id || n.text;
        map.set(key, n);
      }
    });

    // Any notification in myNotifications that is flagged deleted or whose ID is in deletedNotifIds
    (myNotifications || []).forEach((n) => {
      if (n && (n.id || n.text)) {
        const isDel = Boolean(n.deleted || (n.id && deletedNotifIds.includes(n.id)) || (n.text && deletedNotifIds.includes(n.text)));
        if (isDel) {
          const key = n.id || n.text;
          if (!map.has(key)) {
            map.set(key, n);
          }
        }
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const timeA = new Date(a.deletedAt || a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.deletedAt || b.timestamp || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return list;
  }, [deletedNotifications, myNotifications, deletedNotifIds]);

  // Unread count in Received tab
  const unreadReceivedCount = useMemo(() => {
    return receivedNotifications.filter((n) => n.id && !readNotifIds.includes(n.id)).length;
  }, [receivedNotifications, readNotifIds]);

  // Current tab active list
  const currentTabList = useMemo(() => {
    if (activeTab === "received") return receivedNotifications;
    if (activeTab === "completed") return completedNotifications;
    if (activeTab === "deleted") return allDeletedNotifications;
    return receivedNotifications;
  }, [activeTab, receivedNotifications, completedNotifications, allDeletedNotifications]);

  // Filtered list based on search query
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return currentTabList;
    const q = searchQuery.toLowerCase().trim();
    return currentTabList.filter((n) => {
      const matchText = String(n.text || n.message || "").toLowerCase().includes(q);
      const matchAuthor = String(n.authorName || "").toLowerCase().includes(q);
      const matchTarget = String(n.targetName || "").toLowerCase().includes(q);
      const matchProject = String(n.projectName || "").toLowerCase().includes(q);
      const matchType = String(n.targetType || "").toLowerCase().includes(q);
      return matchText || matchAuthor || matchTarget || matchProject || matchType;
    });
  }, [currentTabList, searchQuery]);

  // Handlers for bulk actions based on active tab
  const handleClearCurrentTab = (e: React.MouseEvent) => {
    if (activeTab === "received") {
      if (clearAllReceivedNotifications) {
        clearAllReceivedNotifications(e);
      } else if (clearAllNotifications) {
        clearAllNotifications(e);
      }
    } else if (activeTab === "completed") {
      if (clearAllCompletedNotifications) {
        clearAllCompletedNotifications(e);
      } else if (clearAllNotifications) {
        clearAllNotifications(e);
      }
    } else if (activeTab === "deleted") {
      if (clearAllDeletedNotifications) {
        clearAllDeletedNotifications(e);
      }
    }
  };
  // Extract clean direct comment text (strips '... commented on ...: "comment"')
  const extractDirectComment = (n: any): string => {
    let text = n.text || n.message || n.metadata?.text || n.commentText || "";
    text = String(text).trim();

    const colonIndex = text.lastIndexOf(":");
    const commentKeyword = /commented\s+on\b/i;
    if (commentKeyword.test(text) && colonIndex !== -1) {
      const afterColon = text.substring(colonIndex + 1).trim();
      if (afterColon) {
        text = afterColon;
      }
    }

    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }

    return text;
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full font-sans">
      {/* Breadcrumbs & Page Header */}
      <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
        <div className="flex flex-col gap-1 w-full">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">SYSTEM &gt; NOTIFICATIONS</span>
          <div className="flex items-center justify-between mt-0.5 flex-wrap gap-2">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">Notification Center</h1>
              <span className="text-[15px] font-semibold text-muted-foreground">
                {activeTab === "received" && `${receivedNotifications.length} received`}
                {activeTab === "completed" && `${completedNotifications.length} completed`}
                {activeTab === "deleted" && `${allDeletedNotifications.length} deleted`}
              </span>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === "received" && unreadReceivedCount > 0 && (
                <button
                  onClick={markAllNotifsAsRead}
                  className="h-8.5 px-3.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground font-bold border border-border text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Mark all received notifications as read"
                >
                  <CheckCheck className="size-3.5 text-primary" />
                  <span>Mark All Read</span>
                </button>
              )}

              {activeTab === "received" && receivedNotifications.length > 0 && (
                <button
                  onClick={handleClearCurrentTab}
                  className="h-8.5 px-3.5 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive font-bold border border-destructive/20 text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Move all received notifications to Deleted tab"
                >
                  <Trash2 className="size-3.5" />
                  <span>Move All to Trash</span>
                </button>
              )}

              {activeTab === "completed" && completedNotifications.length > 0 && (
                <button
                  onClick={handleClearCurrentTab}
                  className="h-8.5 px-3.5 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive font-bold border border-destructive/20 text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Move all completed notifications to Deleted tab"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear Completed</span>
                </button>
              )}

              {activeTab === "deleted" && allDeletedNotifications.length > 0 && (
                <>
                  {restoreAllDeletedNotifications && (
                    <button
                      onClick={(e) => restoreAllDeletedNotifications(e)}
                      className="h-8.5 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Restore all deleted notifications to Received"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Restore All</span>
                    </button>
                  )}
                  {clearAllDeletedNotifications && (
                    <button
                      onClick={(e) => clearAllDeletedNotifications(e)}
                      className="h-8.5 px-3.5 rounded-xl bg-destructive/10 hover:bg-destructive/15 text-destructive font-bold border border-destructive/30 text-[12px] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Permanently empty trash"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Empty Trash</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Manage, resolve, and organize your incoming tasks, completed records, and deleted history.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-300">
        
        {/* Toolbar Row: Tab Switcher (Received, Completed, Deleted) + Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 bg-card shrink-0 select-none">
          <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80 self-start">
            {/* Received Tab */}
            <button
              onClick={() => setActiveTab("received")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "received"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Inbox className="size-3.5" />
              <span>Received</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold ${
                activeTab === "received" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {receivedNotifications.length}
              </span>
              {unreadReceivedCount > 0 && activeTab !== "received" && (
                <span className="size-2 rounded-full bg-primary" />
              )}
            </button>

            {/* Completed Tab */}
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "completed"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Completed</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold ${
                activeTab === "completed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
              }`}>
                {completedNotifications.length}
              </span>
            </button>

            {/* Deleted Tab */}
            <button
              onClick={() => setActiveTab("deleted")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                activeTab === "deleted"
                  ? "bg-background text-destructive shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trash2 className="size-3.5 text-destructive/80" />
              <span>Deleted</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-bold ${
                activeTab === "deleted" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
              }`}>
                {allDeletedNotifications.length}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-full sm:max-w-xs md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search in ${activeTab}...`}
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
              <div className={`size-12 rounded-full flex items-center justify-center mx-auto mb-3 border ${
                activeTab === "received"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : activeTab === "completed"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }`}>
                {activeTab === "received" && <Inbox className="size-6" />}
                {activeTab === "completed" && <CheckCircle2 className="size-6" />}
                {activeTab === "deleted" && <Trash2 className="size-6" />}
              </div>
              <h3 className="text-[15px] font-bold text-foreground">
                {searchQuery
                  ? "No matching notifications"
                  : activeTab === "received"
                  ? "Inbox is Empty"
                  : activeTab === "completed"
                  ? "No Completed Tasks"
                  : "Trash is Empty"}
              </h3>
              <p className="text-[12px] text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
                {searchQuery
                  ? `No notifications found matching "${searchQuery}".`
                  : activeTab === "received"
                  ? "You have no active pending notifications or tasks."
                  : activeTab === "completed"
                  ? "When you mark tasks as done, they will be archived here."
                  : "Deleted notifications will appear here before permanent removal."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif, index) => {
              const isCompleted = activeTab === "completed" || Boolean(notif.completed || (notif.id && completedNotifIds.includes(notif.id)));
              const isDeleted = activeTab === "deleted" || Boolean(notif.deleted || (notif.id && deletedNotifIds.includes(notif.id)));
              const isUnread = Boolean(notif.id && !readNotifIds.includes(notif.id) && !isCompleted && !isDeleted);

              const rawText = extractDirectComment(notif);
              const rawAuthor = notif.authorName || notif.metadata?.authorName || "Design Engineer";
              const rawTargetType = notif.targetType || notif.metadata?.targetType || "Location";
              const rawTargetName = notif.targetName || notif.metadata?.targetName || notif.targetId || "";
              const rawProjectName = notif.projectName || notif.metadata?.projectName || "Active Project";
              const rawDate = notif.timestamp || notif.metadata?.createdAt || notif.createdAt || notif.deletedAt || "";

              const dateObj = new Date(rawDate);
              const formattedDate = (!rawDate || isNaN(dateObj.getTime()))
                ? (rawDate || "Just now")
                : `${dateObj.toLocaleDateString()}, ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;

              const rawCalculatorTitle = notif.calculatorTitle || notif.metadata?.calculatorTitle || "";
              const calcName = rawCalculatorTitle || (notif.calculatorPath ? notif.calculatorPath.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Ventilation");

              return (
                <div
                  key={notif.id || `notif_${index}`}
                  onClick={() => {
                    if (notif.id) markNotifAsRead(notif.id);
                    onNavigateToItem(notif);
                  }}
                  className={`w-full p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left relative overflow-hidden group shadow-2xs ${
                    isDeleted
                      ? "bg-destructive/5 border-destructive/20 hover:border-destructive/40"
                      : isCompleted
                      ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                      : isUnread
                      ? "bg-background border-primary/40 shadow-xs hover:border-primary hover:shadow-sm ring-1 ring-primary/10"
                      : "bg-background/80 border-border/80 hover:border-primary/30 hover:bg-background"
                  }`}
                >
                  {isUnread && (
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary" />
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Icon Avatar */}
                      <div
                        className={`size-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                          isDeleted
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : isCompleted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : notif.isCompletionNotif
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : isUnread
                            ? "bg-primary/10 text-primary border-primary/25"
                            : "bg-surface-2 text-muted-foreground border-border"
                        }`}
                      >
                        {isDeleted ? (
                          <Trash2 className="size-4.5 text-destructive" />
                        ) : isCompleted || notif.isCompletionNotif ? (
                          <CheckCircle2 className="size-4.5 text-emerald-500" />
                        ) : (
                          <MessageSquare className="size-4.5 text-primary" />
                        )}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        {/* 1. TOP: SENDER NAME + BADGES + TIME */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-[14px] text-foreground tracking-tight">
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

                          {isDeleted && (
                            <span className="px-2 py-0.2 bg-destructive/15 text-destructive text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-destructive/25">
                              DELETED
                            </span>
                          )}

                          <span className="text-[11px] text-muted-foreground font-medium ml-auto flex items-center gap-1 shrink-0">
                            <Clock className="size-3 text-muted-foreground/70" />
                            {formattedDate}
                          </span>
                        </div>

                        {/* 2. MIDDLE: PROJECT NAME -> CALCULATOR NAME */}
                        <div className="flex flex-wrap items-center gap-2.5 text-[12.5px] font-semibold text-muted-foreground mb-2">
                          <span className="font-bold text-primary flex items-center gap-1.5 bg-primary/5 px-2.5 py-0.5 rounded-md border border-primary/15 shadow-2xs" title={rawProjectName}>
                            <FolderKanban className="size-3.5 text-primary/80" />
                            {rawProjectName}
                          </span>
                          <MoveRight className="w-5.5 h-4 text-muted-foreground/80 stroke-[2.5] shrink-0" />
                          <span className="font-bold text-foreground bg-surface-2 px-2.5 py-0.5 rounded-md border border-border/80 shadow-2xs">
                            {calcName}
                          </span>
                        </div>

                        {/* 3. BOTTOM: ACTUAL COMMENT TEXT */}
                        {rawText && (
                          <p className={`text-[13px] font-medium leading-relaxed text-left break-words ${
                            isDeleted
                              ? "text-muted-foreground/80"
                              : isCompleted
                              ? "text-muted-foreground/80 line-through"
                              : "text-foreground/95"
                          }`}>
                            {rawText}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-start mt-0.5">
                      {/* RECEIVED TAB ACTIONS */}
                      {activeTab === "received" && (
                        <>
                          {!notif.isCompletionNotif && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                completeTaskAndNotifyAuthor(notif, e);
                              }}
                              className="size-8 rounded-full border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="Mark task as completed"
                            >
                              <Check className="size-4 stroke-[2.5]" />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif, e);
                            }}
                            className="size-8 rounded-full border border-destructive/30 text-muted-foreground hover:text-destructive hover:bg-destructive/15 hover:border-destructive flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Delete notification"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}

                      {/* COMPLETED TAB ACTIONS */}
                      {activeTab === "completed" && (
                        <>
                          <div className="size-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center select-none" title="Completed">
                            <Check className="size-4 stroke-[2.5]" />
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif, e);
                            }}
                            className="size-8 rounded-full border border-destructive/30 text-muted-foreground hover:text-destructive hover:bg-destructive/15 hover:border-destructive flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Delete notification"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}

                      {/* DELETED TAB ACTIONS */}
                      {activeTab === "deleted" && (
                        <>
                          {restoreNotification && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreNotification(notif, e);
                              }}
                              className="size-8 rounded-full border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="Restore notification"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          )}

                          {permanentlyDeleteNotification && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                permanentlyDeleteNotification(notif, e);
                              }}
                              className="size-8 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/20 hover:border-destructive flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="Delete permanently"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </>
                      )}
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

