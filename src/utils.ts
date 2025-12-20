export const wait = (delay: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, delay);
});

export const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};
