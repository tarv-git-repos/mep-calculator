async function test() {
  try {
    // We already know admin123 didn't work. Let's try to get a user and see what's wrong.
    console.log("I need a token to test.");
  } catch(e) {
    console.error(e.message);
  }
}
test();
