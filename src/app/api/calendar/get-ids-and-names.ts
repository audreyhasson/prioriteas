// Given an access token, returns all calendar ids of that user

export async function getIdsAndNames(accessToken: string) {
  const ids = await getCalendarIds(accessToken);
  const res: Array<{ summary: string; id: string }> = [];

  for (let i = 0; i < ids.length; i++) {
    const { summary, id } = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList/${ids[i]}`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      }
    ).then((res) => res.json());
    res.push({ summary, id });
  }

  return res;
}

async function getCalendarIds(accessToken: string) {
  const requestBody = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + accessToken,
      },
    }
  ).then((res) => res.json());
  console.log(requestBody);
  return requestBody.items.map((item) => item.id);
}
