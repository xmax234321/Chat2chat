export type NotificationSink = {
  toast: (message: string) => void;
  message: (title: string, body: string) => void;
};

let sink: NotificationSink | null = null;

export function registerNotificationSink(next: NotificationSink | null): void {
  sink = next;
}

export function notifyToast(message: string): void {
  sink?.toast(message);
}

export function notifyMessage(title: string, body: string): void {
  sink?.message(title, body);
}
