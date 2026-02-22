// 資料庫同步功能
class DatabaseSync {
  constructor() {
    this.database = null;
    this.isFirebaseReady = false;
    this.init();
  }

  init() {
    // 檢查 Firebase 是否已加載
    if (typeof firebase !== 'undefined') {
      this.database = firebase.database();
      this.isFirebaseReady = true;
      console.log('資料庫同步已初始化');
    } else {
      console.warn('Firebase 尚未加載，使用本地儲存模式');
    }
  }

  // 儲存日記
  async saveDiary(diaryData) {
    if (this.isFirebaseReady) {
      try {
        const newDiaryRef = this.database.ref('diaries').push();
        await newDiaryRef.set({
          ...diaryData,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        console.log('日記已儲存至 Firebase');
        return newDiaryRef.key;
      } catch (error) {
        console.error('儲存日記失敗:', error);
        this.saveToLocalStorage(diaryData);
      }
    } else {
      this.saveToLocalStorage(diaryData);
    }
  }

  // 儲存筆記
  async saveNote(noteData) {
    if (this.isFirebaseReady) {
      try {
        const newNoteRef = this.database.ref('notes').push();
        await newNoteRef.set({
          ...noteData,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        console.log('筆記已儲存至 Firebase');
        return newNoteRef.key;
      } catch (error) {
        console.error('儲存筆記失敗:', error);
      }
    }
  }

  // 儲存寵物
  async savePet(petData) {
    if (this.isFirebaseReady) {
      try {
        const newPetRef = this.database.ref('pets').push();
        await newPetRef.set({
          ...petData,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        console.log('寵物已儲存至 Firebase');
        return newPetRef.key;
      } catch (error) {
        console.error('儲存寵物失敗:', error);
      }
    }
  }

  // 獲取所有日記
  async getAllDiaries() {
    if (this.isFirebaseReady) {
      try {
        const snapshot = await this.database.ref('diaries').once('value');
        const diaries = [];
        snapshot.forEach((child) => {
          diaries.push({
            id: child.key,
            ...child.val()
          });
        });
        return diaries;
      } catch (error) {
        console.error('獲取日記失敗:', error);
        return this.getFromLocalStorage('diaryHistory') || [];
      }
    } else {
      return this.getFromLocalStorage('diaryHistory') || [];
    }
  }

  // 獲取所有筆記
  async getAllNotes() {
    if (this.isFirebaseReady) {
      try {
        const snapshot = await this.database.ref('notes').once('value');
        const notes = [];
        snapshot.forEach((child) => {
          notes.push({
            id: child.key,
            ...child.val()
          });
        });
        return notes;
      } catch (error) {
        console.error('獲取筆記失敗:', error);
        return this.getFromLocalStorage('notes') || [];
      }
    } else {
      return this.getFromLocalStorage('notes') || [];
    }
  }

  // 獲取所有寵物
  async getAllPets() {
    if (this.isFirebaseReady) {
      try {
        const snapshot = await this.database.ref('pets').once('value');
        const pets = [];
        snapshot.forEach((child) => {
          pets.push({
            id: child.key,
            ...child.val()
          });
        });
        return pets;
      } catch (error) {
        console.error('獲取寵物失敗:', error);
        return this.getFromLocalStorage('pets') || [];
      }
    } else {
      return this.getFromLocalStorage('pets') || [];
    }
  }

  // 刪除日記
  async deleteDiary(diaryId) {
    if (this.isFirebaseReady) {
      try {
        await this.database.ref(`diaries/${diaryId}`).remove();
        console.log('日記已刪除');
      } catch (error) {
        console.error('刪除日記失敗:', error);
      }
    }
  }

  // 刪除筆記
  async deleteNote(noteId) {
    if (this.isFirebaseReady) {
      try {
        await this.database.ref(`notes/${noteId}`).remove();
        console.log('筆記已刪除');
      } catch (error) {
        console.error('刪除筆記失敗:', error);
      }
    }
  }

  // 備份至 localStorage
  saveToLocalStorage(data) {
    const history = JSON.parse(localStorage.getItem('diaryHistory') || '[]');
    history.push(data);
    localStorage.setItem('diaryHistory', JSON.stringify(history));
  }

  // 從 localStorage 獲取
  getFromLocalStorage(key) {
    return JSON.parse(localStorage.getItem(key));
  }

  // 同步 localStorage 資料到 Firebase
  async syncLocalToFirebase() {
    if (!this.isFirebaseReady) return;

    try {
      const localDiaries = this.getFromLocalStorage('diaryHistory') || [];
      const localNotes = this.getFromLocalStorage('notes') || [];

      // 同步日記
      for (const diary of localDiaries) {
        if (!diary.synced) {
          await this.saveDiary(diary);
        }
      }

      // 同步筆記
      for (const note of localNotes) {
        if (!note.synced) {
          await this.saveNote(note);
        }
      }

      console.log('本地資料已同步至 Firebase');
    } catch (error) {
      console.error('同步失敗:', error);
    }
  }
}

// 全域實例
window.dbSync = new DatabaseSync();
