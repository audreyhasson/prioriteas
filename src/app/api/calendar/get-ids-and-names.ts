// Given an access token, returns all calendar ids of that user

export async function getIdsAndNames(accessToken: string) {
  const ids = await getCalendarIds(accessToken);
  const res: Array<{ summary: string; id: string }> = [];

  for (let i = 0; i < ids.length; i++) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList/${ids[i]}`,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + accessToken,
          },
        }
      );
      const data = await response.json();

      // Only add to results if both summary and id are defined
      if (data.summary && data.id) {
        res.push({ summary: data.summary, id: data.id });
      }
    } catch (error) {
      console.error(`Error fetching calendar ${ids[i]}:`, error);
    }
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
