let toastTimer = null;

export function createToast(toast) {
  return function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove("hidden", "hiding");
    toastTimer = window.setTimeout(() => {
      toast.classList.add("hiding");
      window.setTimeout(() => {
        toast.classList.add("hidden");
        toast.classList.remove("hiding");
      }, 160);
    }, 3200);
  };
}
