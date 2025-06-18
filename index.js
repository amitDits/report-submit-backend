const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Task type ID map for "Others" project
const OTHER_PROJECT_TYPE_MAP = {
  "Lunch break": "ccb54773-cf7e-4efd-98c8-3ef11a6fa9f4",
  "Birthday/Anniversary Celebrations": "1528a2dc-bc05-4e82-ab5e-eb876a5b7243",
};

// Task type ID map for "Studio Booking" project
const STUDIO_BOOKING_TYPE_MAP = {
  scrum: "c90c0050-8786-4319-bbee-afc1746fcc81",
  analysis: "dbb732d8-19f7-4d07-a909-fb74fb44ff99",
  approach: "12813ff9-2467-4e1f-9884-7dc7bf6a70f8",
  "client call": "23a17eb9-fc4e-424c-8e12-38bb0c137f19",
  grooming: "7bad6676-35cb-4f05-adbf-45f912cf1ef9",
  development: "92510084-3258-4899-84bf-9b0e3939ce0f",
  "issue analysis": "13cd1cf5-1e7f-42ec-801b-4009fcc6e3de",
  "new requirement": "7aebc4dd-1dbd-4b47-934a-e408dcd7894d",
  "code review": "5421fbb9-050f-4442-9340-50496f998fae",
  discussion: "3db0723b-fbf3-481e-801b-9eddef10170a",
  retrospective: "da7a84bc-2a37-46a0-84b9-575335828245",
  training: "ca9fa480-995e-47b1-9622-555b07920152",
  demo: "8bacc166-1794-4d01-9ea8-4d23b7692f9c",
  "team standup": "3d24cdf0-3f96-4776-9595-97028968eb64",
  testing: "5aa50123-0c0a-45b6-b705-63895790a386",
};

const detectProjectAndType = (taskText) => {
  const text = taskText.toLowerCase();

  if (text.includes("lunch")) {
    return {
      project: "Others",
      type: "Lunch break",
      typeValue: OTHER_PROJECT_TYPE_MAP["Lunch break"],
    };
  }

  if (text.includes("anniversary")) {
    return {
      project: "Others",
      type: "Birthday/Anniversary Celebrations",
      typeValue: OTHER_PROJECT_TYPE_MAP["Birthday/Anniversary Celebrations"],
    };
  }

  for (const [keyword, id] of Object.entries(STUDIO_BOOKING_TYPE_MAP)) {
    if (text.includes(keyword)) {
      return {
        project: "Studio Booking",
        type: keyword,
        typeValue: id,
      };
    }
  }

  return {
    project: "Studio Booking",
    type: "development",
    typeValue: STUDIO_BOOKING_TYPE_MAP["development"],
  };
};

const parseTasks = (text, dateStr) => {
  const [day, month, year] = dateStr.split("-");
  let currentTime = new Date(`${year}-${month}-${day}T09:00:00`);
  const lines = text.split("\n").filter(Boolean);
  const tasks = [];

  for (const line of lines) {
    const [rawTask, rawDuration] = line.split(" - ");
    let minutes = 0;

    const hourMin = rawDuration?.match(/(\d+)\s*hour(?:s)?\s*(\d+)?\s*min/i);
    const minOnly = rawDuration?.match(/(\d+)\s*min/);

    if (hourMin) {
      const h = parseInt(hourMin[1] || "0", 10);
      const m = parseInt(hourMin[2] || "0", 10);
      minutes = h * 60 + m;
    } else if (minOnly) {
      minutes = parseInt(minOnly[1], 10);
    }

    // earlier code
    // const start = new Date(currentTime);
    // const end = new Date(currentTime.getTime() + minutes * 60000);
    const { project, type, typeValue } = detectProjectAndType(rawTask);

    let start, end;
    if (type === "Lunch break") {
      // Fixed lunch break slot
      start = new Date(`${year}-${month}-${day}T13:30:00`);
      end = new Date(`${year}-${month}-${day}T14:00:00`);
      // Move currentTime forward if it's before or during lunch
      if (currentTime < end) {
        currentTime = new Date(end);
      }
    } else {
      start = new Date(currentTime);
      end = new Date(currentTime.getTime() + minutes * 60000);
      currentTime = end;
    }

    tasks.push({
      date: dateStr,
      project,
      type,
      task: rawTask.trim(),
      typeValue,
      start: start.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      end: end.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    });
    // earlier code
    //  currentTime = end;
  }

  return tasks;
};

app.post("/submit", async (req, res) => {
  const { text, date } = req.body;
  const tasks = parseTasks(text, date);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: "auth.json" });
  const page = await context.newPage();

  await page.goto("https://peoplehr.ditstek.com/report/add");
  console.log(tasks, "task");
  for (const task of tasks) {
    const first1 = await page.fill("#reportDate", task.date);
    console.log(first1, "first1");
    const second = await page.selectOption("#projectId", {
      label: task.project,
    });
    console.log(second, "second");
    const third = await page.selectOption("#type", task.typeValue);
    console.log(third, "third");
    const fourth = await page.fill("#start_time", task.start);
    console.log(fourth, "fourth");
    const fifth = await page.fill('input[name="time_to"]', task.end);

    console.log(fifth, "fifth");
    // Wait until Summernote editor is initialized
    await page.waitForSelector(".note-editable");

    // Fill the rich text area properly
    const sixth = await page.locator(".note-editable").fill(task.task);

    console.log(sixth, "sixth");
    //  await page.fill("textarea", task.task);

    await page.click('button:has-text("Add Task")');
    await page.waitForTimeout(2000);
  }

  await page.click('button:has-text("Submit")');
  await browser.close();

  res.json({ message: "Report submitted successfully!" });
});

app.listen(5000, () =>
  console.log("✅ Server running on http://localhost:5000")
);
