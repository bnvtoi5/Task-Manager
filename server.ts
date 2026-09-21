import express from 'express';
import path from 'path';
import https from 'https';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // In-memory circuit breaker to prevent repeated 503 lag spikes during peak hours
  const congestedModels = new Map<string, number>();

  // Mascot AI Chat Route
  app.post('/api/mascot/chat', async (req, res) => {
    try {
      const {
        message,
        personaPrompt,
        contextData,
        chatHistory = [],
        model = 'gemini-flash-latest',
        provider = 'gemini',
        userApiKey,
        customBaseUrl,
      } = req.body;

      // Determine API key with automatic fallback to platform system key
      const sanitizeApiKey = (k?: unknown): string => {
        if (!k || typeof k !== 'string') return '';
        return k.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
      };

      const userKey = sanitizeApiKey(req.headers['x-gemini-api-key'] || userApiKey);
      const systemKey = sanitizeApiKey(process.env.GEMINI_API_KEY);

      let activeKey = userKey || systemKey;
      let fallbackKey = userKey && systemKey && userKey !== systemKey ? systemKey : '';
      let usedSystemFallbackKey = false;

      if (!activeKey) {
        return res.status(400).json({
          error:
            'Chưa cấu hình API Key. Vui lòng nhập Gemini API Key trong phần Cài đặt Mascot hoặc thiết lập GEMINI_API_KEY.',
        });
      }

      let ai = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Construct system instruction combining Persona, Fixed Response Template & Workspace Domain Engine
      const systemInstruction = `
${personaPrompt || 'Bạn là một trợ lý AI thông minh, hỗ trợ quản lý công việc và dự án.'}

=== QUY TẮC CẤU TRÚC PHẢN HỒI BẮT BUỘC (FIXED RESPONSE TEMPLATE & RICH GFM MARKDOWN) ===
Để mọi câu trả lời đều rõ ràng, chuyên nghiệp và có tính trực quan cao nhất, bạn PHẢI tuân thủ cấu trúc khung sườn sau trong trường "reply":

1. **LỜI CHÀO & MỞ ĐẦU CHUẨN MỰC (Persona Opening)**:
   - Mở đầu bằng phong cách xưng hô chuẩn xác của Persona được phân vai (Ví dụ Thầy giáo: "Chào em!", Tổng tài: "Tôi đã xem qua...", Thỏ trợ lý: "Chào bạn nè! 🐰✨", Chuyên gia: "Kính chào anh/chị...").
   - Nêu ngắn gọn và trực diện bản chất câu hỏi/vấn đề trong 1-2 câu.

2. **NỘI DUNG PHÂN TÍCH CHIA MỤC 1-2-3 (Structured Core)**:
   - BẮT BUỘC chia thành các mục số rõ ràng (ví dụ: "### 1. Phân tích bối cảnh", "### 2. Kế hoạch hành động", "### 3. Lưu ý quan trọng").
   - Dùng in đậm (**từ khóa trọng tâm**) và bullet points để tăng khả năng quét thông tin.

3. **BẢNG BIỂU TỔNG HỢP GFM MARKDOWN (Table Comparison / Overview)**:
   - Khi có nhiều dữ liệu (danh sách công việc, kế hoạch theo thời gian, so sánh phương án, ưu/nhược điểm, phân công nhiệm vụ, hoặc trạng thái hệ thống), BẮT BUỘC dùng bảng GFM Markdown chuẩn:
     | Hạng mục / Tiêu đề | Trạng thái / Độ ưu tiên | Vị trí / Chi tiết | Ghi chú / Deadline |
     | :--- | :--- | :--- | :--- |
     | Việc A | ⏳ Chờ làm / 🔴 Cao | [Divi 1] > [Cụm 1] | ⏰ 08:00 (Hôm nay) |
   - Bảng này sẽ được hệ thống hiển thị kẻ ô, bo góc và hỗ trợ cuộn ngang linh hoạt trên di động.

4. **KHỐI MÃ NGUỒN / CÔNG THỨC (Code Blocks)**:
   - Nếu câu trả lời có chứa mã nguồn, lệnh SQL, cấu trúc JSON hoặc công thức, PHẢI đặt trong code block có chỉ định ngôn ngữ (\`\`\`typescript, \`\`\`sql, \`\`\`json, \`\`\`python, \`\`\`markdown, v.v.) để người dùng có thể sao chép 1 chạm.

5. **KẾT LUẬN & HÀNH ĐỘNG TIẾP THEO (Next Steps & Summary)**:
   - Tóm lược lời khuyên chốt hoặc câu hỏi gợi mở tiếp theo phù hợp với Persona.

=== NGUYÊN TẮC HỆ THỐNG VÀ QUY TRÌNH PHÂN TÍCH Ý ĐỊNH (BẮT BUỘC TUÂN THỦ) ===
Khi nhận tin nhắn từ người dùng, bạn PHẢI phân tích kỹ câu thoại theo quy trình phân luồng 2 nhánh sau đây, KHÔNG ĐƯỢC chỉ bắt từ khóa rời rạc rồi tự ý chốt lệnh:

--- NHÁNH 1: TRÒ CHUYỆN, TƯ VẤN, TÌM KIẾM & TRA CỨU (CHIT-CHAT / ADVICE / SEARCH & LIST) ---
KHI NÀO KÍCH HOẠT:
- Người dùng chào hỏi ("Chào bạn", "Hi mascot", "Hôm nay thế nào?").
- Người dùng tâm sự, than thở, chia sẻ cảm xúc ("Hôm nay mệt quá", "Áp lực deadline quá", "Vui quá").
- Người dùng hỏi thăm tính năng, hỏi ý kiến, xin lời khuyên ("Làm sao để tập trung?", "Bạn thấy tôi nên làm gì trước?").
- Người dùng tìm kiếm công việc ("tìm task làm bánh", "tìm việc về họp", "có công việc nào liên quan tới X không?").
- Người dùng tìm kiếm chu kỳ (period), phân chia (division), cụm (cluster) ("tìm period 1", "danh sách period", "có những chu kỳ nào").
- Người dùng xem/liệt kê danh sách ("danh sách việc hôm nay", "có những task nào đang chờ", "xem việc có báo thức").
- Người dùng đang phân vân hoặc giả định ("Có nên xóa task A không nhỉ?", "Task này có vẻ không cần thiết").

QUY TẮC TÌM KIẾM & TRA CỨU (CỰC KỲ QUAN TRỌNG):
1. Khi người dùng tìm kiếm hoặc hỏi danh sách việc: Bạn PHẢI duyệt qua TOÀN BỘ danh sách tasks trong contextData.
2. Khi người dùng tìm kiếm chu kỳ (Period) / phân chia (Division): Bạn PHẢI đối chiếu với contextData.periods hoặc contextData.divisions, liệt kê đầy đủ tên, ID, và các công việc/phân chia liên quan.
3. TUYỆT ĐỐI KHÔNG ĐƯỢC CHỈ CHỌN RA 1 KẾT QUẢ DUY NHẤT (top 1)! Phải giữ lại và liệt kê TẤT CẢ các đáp án liên quan khả quan (khớp từ khóa, khớp ngữ cảnh, hoặc cùng phân loại/chủ đề).
4. Định dạng hiển thị danh sách tìm kiếm / liệt kê việc phải RÕ RÀNG VÀ ĐẸP MẮT:
   - Tiêu đề công việc (in đậm)
   - Trạng thái (⏳ Chờ làm / ⚡ Đang làm / ✅ Hoàn thành) & Độ ưu tiên (🚨 Khẩn cấp / 🔴 Cao / 🟡 Vừa / 🟢 Thấp)
   - Vị trí: [Phân chia] > [Cụm]
   - Báo thức ⏰: Nếu task có báo thức (alarm_enabled: true), ghi rõ: "⏰ Báo thức: [alarm_time hoặc alarm_at]" và trạng thái chuông. Nếu không có, ghi "⏰ Không có chuông".
   - Hạn chót (nếu có).
5. TUYỆT ĐỐI KHÔNG TỰ Ý TẠO, SỬA HOẶC XÓA DỮ LIỆU khi người dùng chỉ tìm kiếm hoặc hỏi han! Bắt buộc trả về "proposals": [] (mảng rỗng).

--- NHÁNH 2: TÁC VỤ CÔNG VIỆC THỰC SỰ (TASK & WORKSPACE ACTION) ---
KHI NÀO KÍCH HOẠT:
- Người dùng đưa ra LỆNH RÕ RÀNG VÀ CHỦ ĐÍCH muốn thay đổi dữ liệu hệ thống:
  1. Tạo công việc mới (create_task)
  2. Cập nhật công việc (update_task)
  3. Xóa công việc (delete_task)
  4. Hẹn giờ báo thức cho task (set_alarm)
  5. Tắt / Hủy báo thức cho task (cancel_alarm)
  6. Tạo / Cập nhật / Xóa Cụm việc (Cluster: create_cluster, update_cluster, delete_cluster)
  7. Tạo / Cập nhật / Xóa Phân chia (Division: create_division, update_division, delete_division)
  8. Tạo / Cập nhật / Xóa Chu kỳ (Period: create_period, update_period, delete_period)
  9. Tạo / Cập nhật / Xóa Phòng làm việc (Workspace: create_workspace, update_workspace, delete_workspace)

QUY TRÌNH XÁC THỰC Ý ĐỊNH TRƯỚC KHI TẠO PROPOSAL:
1. Xác định rõ mục tiêu: Đối chiếu với dữ liệu ngữ cảnh (contextData) để tìm ID thật của task, cụm, phân chia, chu kỳ (period), hoặc phòng làm việc.
2. Kiểm tra tính rõ ràng:
   - Nếu lệnh mơ hồ (ví dụ: "Xóa việc đi" nhưng danh sách có 10 việc và không nói rõ việc nào), bạn PHẢI phản hồi hỏi lại người dùng để làm rõ, ĐỂ "proposals": [].
   - Nếu lệnh rõ ràng ("Xóa task Viết báo cáo", "Xóa hẳn period 1", "Tạo task Mua cà phê trong cụm Marketing", "Đặt báo thức task Báo cáo lúc 09:00"), hãy tạo proposal chính xác.

QUY TẮC PHÂN BIỆT RÕ RÀNG GIỮA PERIOD VÀ DIVISION (CỰC KỲ QUAN TRỌNG - TUYỆT ĐỐI KHÔNG ĐƯỢC NHẦM LẪN):
- Cấu trúc thứ bậc của ứng dụng có 5 cấp rõ rệt:
  * Cấp 1: Phòng làm việc (Workspace)
  * Cấp 2: Chu kỳ / Giai đoạn (Period) - chứa các Division và Task trong chu kỳ đó (VD: Period 1, Period 2, Tuần 1, Tháng 9, Sprint 1...)
  * Cấp 3: Phân chia (Division) - nhóm công việc chuyên môn nằm bên trong một Period (VD: Marketing, Kế toán, Kỹ thuật, Design...)
  * Cấp 4: Cụm việc / Cột (Cluster) - các cột trong Division (Cụm 1, Cụm 2, To Do, In Progress...)
  * Cấp 5: Công việc (Task) - các task cụ thể

- KHI NGƯỜI DÙNG NÓI "PERIOD" HOẶC "CHU KỲ" HOẶC "GIAI ĐOẠN":
  Ví dụ: "xóa hẳn period 1", "xóa period 1", "xóa chu kỳ 1", "tạo period mới Tháng 10", "sửa period 1 thành Sprint 1", "tìm period 1":
  -> ĐÂY LÀ THAO TÁC VỚI PERIOD!
  -> BẮT BUỘC dùng các action: delete_period, create_period, update_period!
  -> TUYỆT ĐỐI KHÔNG ĐƯỢC NHẦM THÀNH delete_division hay update_division!
  -> Hãy tìm period có tên hoặc id khớp với "Period 1" hoặc chu kỳ tương ứng trong danh sách contextData.periods, rồi điền chính xác period_id.
  -> Trong summary khi xóa: "Xóa hẳn chu kỳ (Period) [tên period] cùng toàn bộ phân chia và công việc trực thuộc".

- KHI NGƯỜI DÙNG NÓI "DIVISION" HOẶC "PHÂN CHIA" HOẶC "NHÓM VIỆC":
  Ví dụ: "xóa division Marketing", "xóa phân chia 1", "tạo division mới":
  -> ĐÂY LÀ THAO TÁC VỚI DIVISION! Dùng action: delete_division, create_division, update_division.

3. QUY TẮC HẸN GIỜ BÁO THỨC (set_alarm HOẶC create_task có báo thức):
   - alarm_time: Thời gian hiển thị rõ ràng bằng tiếng Việt cho người dùng (Ví dụ: "08:00 ngày 19/09/2026", "08:00", "15:30"). KHÔNG ĐƯỢC để chuỗi ISO thô vào alarm_time!
   - alarm_at: Chuỗi ISO Datetime "YYYY-MM-DDTHH:mm:ss" theo đúng giờ địa phương mà người dùng yêu cầu (Ví dụ: "2026-09-19T08:00:00").
   - alarm_enabled: true.
   - alarm_repeat: "none" | "daily" | "weekly".

4. QUY TẮC TẮT / HỦY BÁO THỨC CHO TASK (cancel_alarm):
   - KHI NGƯỜI DÙNG YÊU CẦU: "tắt báo thức", "hủy báo thức", "tắt chuông", "hủy chuông", "tắt hẹn giờ", "hủy hẹn giờ", "bỏ báo thức" (cho một task cụ thể hoặc chung):
     * Ví dụ: "tắt báo thức cho task làm bánh", "hủy báo thức task Viết báo cáo", "làm bánh tắt báo thức", "tắt chuông việc X".
     * Action: "cancel_alarm"
     * Tìm task tương ứng trong contextData.tasks: lấy task_id chính xác.
     * target_name: Tên của công việc đó.
     * summary: "Tắt / Hủy báo thức cho công việc: [tên công việc]"
     * details: { "task_id": string }
     * Nếu người dùng nói chung chung "tắt báo thức" mà chỉ có 1 task đang bật báo thức, hãy chọn task đó. Nếu có nhiều task đang bật báo thức và không rõ việc nào, hãy liệt kê các task đó trong reply và hỏi lại để người dùng chọn, để "proposals": [].

5. QUY TẮC DI CHUYỂN CÔNG VIỆC SANG PHÂN CHIA (DIVISION / DIVI) KHÁC (move_task):
   - KHI NGƯỜI DÙNG YÊU CẦU: "chuyển task X sang divi Y", "di chuyển task X từ divi A sang divi B", "đổi task X sang phân chia Y", "chuyển việc X qua division Y", "chuyển task X sang divi khác":
     * Action: "move_task"
     * target_name: Tên của công việc được di chuyển.
     * Tìm task tương ứng trong contextData.tasks: lấy task_id chính xác.
     * Tìm division đích trong contextData.divisions:
       - Có thể theo tên division (ví dụ: "Marketing", "Kế toán") hoặc theo số thứ tự (ví dụ: "divi 2", "phân chia 1").
       - Lấy target_division_id, target_division_name, target_period_id, target_workspace_id.
     * Nếu người dùng có yêu cầu cụm cụ thể trong division đó (ví dụ: "chuyển task X sang divi 2 cụm 3", "vào cụm Đang làm của divi Marketing"):
       - Tìm cluster trong contextData.clusters thuộc division đích hoặc ghi rõ target_cluster_name, cluster_index.
     * summary: "Di chuyển công việc [tên việc] sang phân chia [tên division đích] (Cụm: [tên cụm nếu có])"
     * details: {
         "task_id": string,
         "target_division_id": string,
         "target_division_name": string,
         "target_period_id"?: string,
         "target_workspace_id"?: string,
         "target_cluster_id"?: string,
         "target_cluster_name"?: string,
         "cluster_index"?: number
       }
     * TUYỆT ĐỐI KHÔNG gán nhầm thành create_division hay create_task! Đây là di chuyển công việc đã có sang phân chia khác.

6. ĐẶC BIỆT KHI TẠO TASK (create_task), CẬP NHẬT TASK (update_task) VÀ DI CHUYỂN TASK (move_task):
   Bạn BẮT BUỘC phải xác định rõ ĐẦY ĐỦ 5 CẤP THỨ BẬC CỦA HỆ THỐNG:
   * Cấp 1 - Phòng (Workspace): workspace_id, workspace_name
   * Cấp 2 - Chu kỳ (Period): period_id, period_name
   * Cấp 3 - Phân chia (Division): division_id, division_name
   * Cấp 4 - Chế độ bảng (Board Mode): board_mode_id, board_mode_name
   * Cấp 5 - Cụm / Cột (Cluster): cluster_id, cluster_name, cluster_index
   
   QUY TẮC XÁC ĐỊNH CHUẨN XÁC CHẾ ĐỘ BẢNG (BOARD MODE) KHI TÁC ĐỘNG ĐẾN DB:
   Trong contextData cung cấp:
   - 'active_board_mode': Chế độ bảng đang được xem.
   - 'active_division_board_modes' / 'board_modes': Danh sách tất cả các Chế độ bảng kèm các cột (clusters) của từng chế độ.
   - 'active_clusters': Danh sách các cột/cụm đang hiển thị trên bảng.
   
   Khi người dùng yêu cầu tạo task, sửa task, chuyển task vào một cột/cụm cụ thể (ví dụ: "thêm task mới vào đang nghiên cứu", "thêm task vào cột 2", "chuyển việc sang Đang nghiên cứu"):
   + Bạn PHẢI tìm kiếm và đối chiếu tên cột (như "Đang nghiên cứu") trong danh sách 'clusters' của các Chế độ bảng thuộc phân chia đó.
   + Xác định chính xác 'board_mode_id' và 'board_mode_name' của Chế độ bảng chứa cột đó!
   + Điền đầy đủ "board_mode_id" và "board_mode_name" vào 'details' của proposal.
   + Nếu phân chia chưa có Chế độ bảng (active_division_has_board_mode === false), BẮT BUỘC tạo 'create_board_mode' trước rồi mới 'create_task' như quy tắc 8.
   + Nếu người dùng yêu cầu "cụm 1" hoặc "cột 1": gán vào cụm có index = 1.
   + Nếu người dùng yêu cầu "cụm 2" hoặc "cột 2": BẮT BUỘC gán vào cụm có index = 2 trong active_clusters. Điền chính xác cluster_id, cluster_name, và kèm theo "cluster_index": 2 trong details.
   + Nếu người dùng yêu cầu "cụm N" / "cột N" (ví dụ cụm 3, cụm 4...): gán vào cụm có index = N.
   + Trong summary, PHẢI ghi rõ ràng đầy đủ 5 cấp:
     "Tạo công việc [tên việc] tại: Phòng: [tên phòng] | Period: [tên period] | Division: [tên division] | Chế độ: [tên chế độ bảng] | Cụm: [tên cụm]".
     (Ví dụ: "Tạo công việc mới tại: Phòng: R&D | Period: Chu kỳ 1 | Division: Phát triển & Thử nghiệm | Chế độ: Kanban R&D | Cụm: Đang nghiên cứu")

7. Nguyên tắc bảo mật & an toàn:
   - Tất cả các thao tác thay đổi dữ liệu đều KHÔNG ĐƯỢC chạy ngầm. Phải đưa vào danh sách proposals để người dùng duyệt trên giao diện.
   - Mỗi proposal phải có "status": "pending".

8. QUY TẮC ĐÚNG VÀ ĐỦ QUY TRÌNH - BẮT BUỘC KIỂM TRA CHẾ ĐỘ BẢNG (BOARD MODE) TRƯỚC KHI TẠO CÔNG VIỆC:
- Cấu trúc thứ bậc của hệ thống:
  1. Phòng làm việc (Workspace)
  2. Chu kỳ (Period)
  3. Phân chia (Division)
  4. Chế độ bảng (Board Mode) và các Cột/Cụm Kanban (BoardModeCluster)
  5. Công việc (Task)
- "Chế độ bảng" (Board Mode) là điều kiện tiên quyết bắt buộc để hiển thị các cụm cột và sắp xếp công việc trên bảng Kanban của một Phân chia. Nếu một Phân chia CHƯA CÓ Chế độ bảng (active_division_has_board_mode === false hoặc không có chế độ bảng nào thuộc division đó trong division_board_modes / board_modes), thì:
  * TUYỆT ĐỐI KHÔNG ĐƯỢC TẠO TASK TRƯỚC KHI CÓ CHẾ ĐỘ BẢNG! Tạo task khi chưa có chế độ bảng là SAI QUY TRÌNH và sẽ khiến phân chia không hiển thị được việc.
  * PHẢI THỰC HIỆN ĐÚNG VÀ ĐỦ QUY TRÌNH:
    1. Khi người dùng yêu cầu thiết lập công việc cho một phòng/phân chia mới hoặc chưa có chế độ bảng (ví dụ: "tạo các nhiệm vụ quan trọng cho phòng ban lập trình máy tính", "lên danh sách việc cho phòng IT", "tạo việc cho phân chia X"):
       - Bạn PHẢI giải thích rõ ràng cho người dùng: Phân chia hiện tại chưa có Chế độ bảng (Board Mode) để phân chia các cột công việc. Theo đúng quy trình vận hành, cần thiết lập Chế độ bảng trước (ví dụ Chế độ bảng "Kanban Lập trình" gồm các cột: Cần làm, Đang làm, Kiểm thử, Hoàn thành), sau đó mới tạo các nhiệm vụ tương ứng vào các cột đó.
       - Bạn có thể gợi ý/hỏi người dùng: "Phân chia này hiện chưa có chế độ bảng, bạn có muốn đặt tên chế độ bảng theo ý mình không, hay tớ sẽ tạo Chế độ bảng [Tên gợi ý] với các cột chuẩn quy trình cho bạn nhé?".
       - Trong danh sách proposals, bạn BẮT BUỘC phải đặt proposal create_board_mode TRƯỚC các proposal create_task:
         * Thứ tự proposals chuẩn hóa:
           [1] create_workspace (nếu phòng chưa có)
           [2] create_period (nếu chu kỳ chưa có)
           [3] create_division (nếu phân chia chưa có)
           [4] create_board_mode: Tạo Chế độ bảng (name: Tên chế độ bảng như "Kanban Lập trình", clusters: [{ name: "Cần làm", color: "#6366F1" }, { name: "Đang làm", color: "#F59E0B" }, { name: "Kiểm thử", color: "#8B5CF6" }, { name: "Hoàn thành", color: "#10B981" }])
           [5+] create_task: Sau khi có chế độ bảng mới tạo các task với cluster_name khớp với các cột vừa thiết lập của chế độ bảng!

=== DỮ LIỆU NGỮ CẢNH HỆ THỐNG HIỆN TẠI ===
Thời gian hệ thống hiện tại: ${new Date().toLocaleString('vi-VN')} (ISO: ${new Date().toISOString()})
Dữ liệu cấu trúc hiện có trong phòng làm việc:
${JSON.stringify(contextData || {}, null, 2)}

=== ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (JSON ONLY) ===
Bạn PHẢI trả về duy nhất một JSON object hợp lệ:
{
  "reply": "Câu trả lời theo đúng văn phong Persona. Nếu là Nhánh 1: trò chuyện súc tích, duyên dáng, liệt kê kết quả tìm kiếm đầy đủ các phương án khả quan. Nếu là Nhánh 2: thông báo rõ đã chuẩn bị đề xuất thao tác và mời người dùng duyệt.",
  "proposals": [
    {
      "id": "proposal-1",
      "action": "create_task" | "update_task" | "move_task" | "delete_task" | "set_alarm" | "cancel_alarm" | "create_cluster" | "update_cluster" | "delete_cluster" | "create_division" | "update_division" | "delete_division" | "create_period" | "update_period" | "delete_period" | "create_workspace" | "update_workspace" | "delete_workspace" | "create_board_mode" | "update_board_mode" | "delete_board_mode",
      "target_name": "Tên cụ thể của đối tượng (ví dụ: 'Hoàn thiện slide dự án', 'Period 1', 'Cụm Kế toán', v.v.)",
      "summary": "Mô tả hành động bằng tiếng Việt ngắn gọn, dễ hiểu",
      "status": "pending",
      "details": {
        // create_task: { "title": string, "description"?: string, "priority"?: "low"|"medium"|"high"|"urgent", "status"?: "todo"|"in_progress"|"review"|"done", "due_date"?: string, "alarm_enabled"?: boolean, "alarm_time"?: string, "alarm_at"?: string, "workspace_id"?: string, "workspace_name"?: string, "period_id"?: string, "period_name"?: string, "division_id"?: string, "division_name"?: string, "board_mode_id"?: string, "board_mode_name"?: string, "cluster_id"?: string, "cluster_name"?: string, "cluster_index"?: number }
        // update_task: { "task_id": string, "title"?: string, "description"?: string, "priority"?: string, "status"?: string, "due_date"?: string, "board_mode_id"?: string, "board_mode_name"?: string, "cluster_id"?: string, "cluster_name"?: string, "cluster_index"?: number }
        // move_task: { "task_id": string, "target_division_id": string, "target_division_name"?: string, "target_board_mode_id"?: string, "target_board_mode_name"?: string, "target_period_id"?: string, "target_workspace_id"?: string, "target_cluster_id"?: string, "target_cluster_name"?: string, "cluster_index"?: number }
        // delete_task: { "task_id": string }
        // set_alarm: { "task_id": string, "alarm_enabled": true, "alarm_time": string, "alarm_at": string, "alarm_repeat"?: "none"|"daily"|"weekly" }
        // cancel_alarm: { "task_id": string }
        // create_board_mode: { "name": string, "description"?: string, "division_id"?: string, "division_name"?: string, "clusters"?: Array<{ "name": string, "color"?: string } | string> }
        // update_board_mode: { "board_mode_id": string, "name"?: string, "description"?: string }
        // delete_board_mode: { "board_mode_id": string }
        // create_cluster: { "name": string, "description"?: string, "color"?: string, "division_id"?: string }
        // update_cluster: { "cluster_id": string, "name"?: string, "color"?: string }
        // delete_cluster: { "cluster_id": string }
        // create_division: { "name": string, "description"?: string, "workspace_id"?: string, "period_id"?: string }
        // update_division: { "division_id": string, "name"?: string }
        // delete_division: { "division_id": string }
        // create_period: { "name": string, "description"?: string, "workspace_id"?: string, "start_date"?: string, "end_date"?: string }
        // update_period: { "period_id": string, "name"?: string, "description"?: string }
        // delete_period: { "period_id": string, "name"?: string }
        // create_workspace: { "name": string, "description"?: string, "color"?: string }
        // update_workspace: { "workspace_id": string, "name"?: string, "description"?: string }
        // delete_workspace: { "workspace_id": string }
      }
    }
  ]
}
Nếu người dùng chỉ trò chuyện hỏi han hoặc tìm kiếm tra cứu, không yêu cầu thay đổi dữ liệu, hãy để "proposals": [].
`;

      // Build conversation contents
      const formattedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Include last 6 messages from chat history for context
      if (Array.isArray(chatHistory)) {
        const recentHistory = chatHistory.slice(-6);
        for (const msg of recentHistory) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            formattedContents.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content || '' }],
            });
          }
        }
      }

      // Add current message
      formattedContents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Clean and normalize model name
      const normalizeGeminiModel = (m?: string): string => {
        const raw = (m || '').trim().toLowerCase();
        if (
          !raw ||
          raw === 'gemini-2.5-flash' ||
          raw === 'gemini-3.0-flash' ||
          raw === 'gemini-3.6-flash' ||
          raw.includes('gemini-2.0') ||
          raw.includes('gemini-1.5')
        ) {
          return 'gemini-flash-latest';
        }
        if (raw === 'gemini-2.5-flash-lite') {
          return 'gemini-3.1-flash-lite';
        }
        if (raw === 'gemini-2.5-pro' || raw === 'gemini-pro') {
          return 'gemini-3.1-pro-preview';
        }
        return (m || '').trim();
      };

      const initialModel = normalizeGeminiModel(model);

      // 1. If non-Gemini provider with User API Key (OpenAI, DeepSeek, OpenRouter, Claude, Custom API)
      if (provider && provider !== 'gemini' && userApiKey) {
        try {
          if (provider === 'claude') {
            const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': userApiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: model || 'claude-3-5-haiku-latest',
                max_tokens: 2048,
                system: systemInstruction,
                messages: [
                  ...(Array.isArray(chatHistory)
                    ? chatHistory.slice(-6).map((m: any) => ({
                        role: m.role === 'assistant' ? 'assistant' : 'user',
                        content: m.content || '',
                      }))
                    : []),
                  { role: 'user', content: message },
                ],
                temperature: 0.7,
              }),
            });

            if (claudeResp.ok) {
              const claudeData = (await claudeResp.json()) as any;
              const content = claudeData.content?.[0]?.text || '{}';
              let parsed: { reply?: string; proposals?: any[] } = {};
              try {
                parsed = JSON.parse(content);
              } catch {
                const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
                try {
                  parsed = JSON.parse(cleaned);
                } catch {
                  parsed = { reply: content, proposals: [] };
                }
              }
              return res.json({
                reply: parsed.reply || 'Đã tiếp nhận yêu cầu.',
                proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
                modelUsed: model || 'claude-3-5-haiku-latest',
                fellBack: false,
              });
            }
          } else {
            let endpoint = customBaseUrl?.trim();
            if (!endpoint) {
              if (provider === 'openai') endpoint = 'https://api.openai.com/v1';
              else if (provider === 'deepseek') endpoint = 'https://api.deepseek.com';
              else if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1';
            }

            if (endpoint) {
              const openAiMessages = [
                { role: 'system', content: systemInstruction },
                ...(Array.isArray(chatHistory)
                  ? chatHistory.slice(-6).map((m: any) => ({
                      role: m.role === 'assistant' ? 'assistant' : 'user',
                      content: m.content || '',
                    }))
                  : []),
                { role: 'user', content: message },
              ];

              const chosenProviderModel =
                model && model !== 'custom'
                  ? model
                  : provider === 'deepseek'
                  ? 'deepseek-chat'
                  : provider === 'openai'
                  ? 'gpt-4o-mini'
                  : 'meta-llama/llama-3.3-70b-instruct';

              const resp = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${userApiKey}`,
                },
                body: JSON.stringify({
                  model: chosenProviderModel,
                  messages: openAiMessages,
                  temperature: 0.7,
                  response_format: { type: 'json_object' },
                }),
              });

              if (resp.ok) {
                const respData = (await resp.json()) as any;
                const content = respData.choices?.[0]?.message?.content || '{}';
                let parsed: { reply?: string; proposals?: any[] } = {};
                try {
                  parsed = JSON.parse(content);
                } catch {
                  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
                  try {
                    parsed = JSON.parse(cleaned);
                  } catch {
                    parsed = { reply: content, proposals: [] };
                  }
                }
                return res.json({
                  reply: parsed.reply || 'Đã tiếp nhận yêu cầu.',
                  proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
                  modelUsed: chosenProviderModel,
                  fellBack: false,
                });
              }
            }
          }
        } catch (providerErr) {
          console.warn('[AI Multi-Provider] Custom provider request failed, falling back to Gemini chain:', providerErr);
        }
      }

      // 2. Google Gemini provider with Multi-Model Fallback & Circuit-Breaker
      // Candidate models ordered from fastest/default to ultra-high capacity fallbacks
      const candidateList = [
        initialModel,
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.1-pro-preview',
      ];
      const uniqueCandidates = Array.from(new Set(candidateList));

      // Sort candidates using Circuit Breaker: healthy candidates first, congested ones last
      const now = Date.now();
      const healthyCandidates: string[] = [];
      const coolingCandidates: string[] = [];
      for (const m of uniqueCandidates) {
        const cooldown = congestedModels.get(m) || 0;
        if (cooldown > now) {
          coolingCandidates.push(m);
        } else {
          healthyCandidates.push(m);
        }
      }
      const fallbackChain: string[] = [...healthyCandidates, ...coolingCandidates];

      let responseText = '';
      let successfulModel = initialModel;
      let lastModelError: Error | null = null;
      let fellBack = false;

      for (let i = 0; i < fallbackChain.length; i++) {
        const currentModel = fallbackChain[i];
        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: formattedContents,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });

          if (response && response.text) {
            responseText = response.text;
            successfulModel = currentModel;
            fellBack = i > 0;
            // Clear any old congested flag on success
            congestedModels.delete(currentModel);
            break;
          }
        } catch (callErr: unknown) {
          lastModelError = callErr instanceof Error ? callErr : new Error(String(callErr));
          const errMsg = lastModelError.message || String(callErr);
          console.warn(
            `[AI Chat] Model "${currentModel}" failed (${errMsg}). Attempting rollback to next candidate...`
          );

          // Check if error is due to invalid API key
          const isApiKeyInvalid =
            errMsg.includes('API_KEY_INVALID') ||
            errMsg.includes('API key not valid') ||
            errMsg.includes('API_KEY_SERVICE_BLOCKED') ||
            errMsg.includes('UNAUTHENTICATED') ||
            errMsg.includes('invalid authentication credentials') ||
            errMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
            errMsg.includes('401');

          if (isApiKeyInvalid) {
            if (fallbackKey && !usedSystemFallbackKey) {
              console.warn(
                `[AI Key Fallback] Custom API key is invalid (${errMsg}). Automatically falling back to platform GEMINI_API_KEY.`
              );
              activeKey = fallbackKey;
              usedSystemFallbackKey = true;
              ai = new GoogleGenAI({
                apiKey: activeKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  },
                },
              });
              // Reset index to retry with valid platform key
              i--;
              continue;
            } else {
              // If no fallback key or platform key itself is invalid, halt loop immediately to avoid redundant errors
              console.error(`[AI Key Error] Active API key is invalid (${errMsg}). Halting candidate chain.`);
              return res.status(400).json({
                error: userKey
                  ? 'API Key cá nhân bạn nhập không hợp lệ hoặc đã hết hạn (bắt đầu bằng AIzaSy...). Vui lòng kiểm tra lại API Key trong mục Cài đặt Mascot.'
                  : 'Khóa API chưa được cấu hình hoặc đã hết hạn. Vui lòng dán Gemini API Key của bạn (bắt đầu bằng AIzaSy...) vào mục Cài đặt Mascot để sử dụng.',
                apiKeyInvalid: true,
              });
            }
          }

          // If high demand spike (503 / UNAVAILABLE) or rate limit (429), mark in 45s cooldown
          if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429')) {
            congestedModels.set(currentModel, Date.now() + 45000);
            console.warn(`[AI Circuit Breaker] Model "${currentModel}" marked congested for 45s to eliminate retry lag.`);
          }
        }
      }

      if (!responseText) {
        throw (
          lastModelError ||
          new Error('Tất cả các model trong chuỗi rollback đều không phản hồi.')
        );
      }

      let parsedData: { reply?: string; proposals?: unknown[] };
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        // Fallback in case wrapped in markdown
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      return res.json({
        reply: parsedData.reply || 'Đã tiếp nhận yêu cầu của bạn.',
        proposals: Array.isArray(parsedData.proposals) ? parsedData.proposals : [],
        modelUsed: successfulModel,
        fellBack,
        usedSystemFallbackKey,
        systemFallbackNotice: usedSystemFallbackKey
          ? 'Khóa API cá nhân bạn đã nhập không hợp lệ nên hệ thống đã tự động dùng API Key mặc định của hệ thống để hỗ trợ bạn.'
          : undefined,
      });
    } catch (err: unknown) {
      console.error('Mascot chat error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi gọi AI';
      return res.status(500).json({ error: errorMsg });
    }
  });

  // Mascot API Connection Test Route
  app.post('/api/mascot/test-connection', async (req, res) => {
    const startTime = Date.now();
    try {
      const {
        provider = 'gemini',
        model = 'gemini-3.1-flash-lite',
        apiKey: rawApiKey,
        customBaseUrl,
      } = req.body;

      const sanitizeApiKey = (k?: unknown): string => {
        if (!k || typeof k !== 'string') return '';
        return k.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
      };

      const userKey = sanitizeApiKey(rawApiKey || req.headers['x-gemini-api-key']);
      const systemKey = sanitizeApiKey(process.env.GEMINI_API_KEY);

      // Handle Gemini
      if (provider === 'gemini') {
        const effectiveKey = userKey || systemKey;
        const isUsingSystemKey = !userKey && Boolean(systemKey);

        if (!effectiveKey) {
          return res.status(400).json({
            ok: false,
            provider: 'gemini',
            message: 'Chưa cấu hình API Key. Vui lòng nhập Gemini API Key hoặc kiểm tra biến GEMINI_API_KEY trên hệ thống.',
            code: 'API_KEY_MISSING',
          });
        }

        let targetModel = model?.trim() || 'gemini-3.1-flash-lite';
        if (targetModel === 'custom' || !targetModel) {
          targetModel = 'gemini-3.1-flash-lite';
        }

        try {
          const ai = new GoogleGenAI({
            apiKey: effectiveKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const testResp = await ai.models.generateContent({
            model: targetModel,
            contents: 'Xin chào, phản hồi ngắn gọn đúng 2 từ: Đã kết nối',
            config: {
              maxOutputTokens: 20,
              temperature: 0.1,
            },
          });

          const latencyMs = Date.now() - startTime;
          const replyText = testResp.text?.trim() || 'Đã kết nối';

          return res.json({
            ok: true,
            provider: 'gemini',
            modelUsed: targetModel,
            latencyMs,
            keySource: isUsingSystemKey ? 'system' : 'custom',
            message: `Kết nối thành công tới Google Gemini (${targetModel})!`,
            sampleReply: replyText,
            timestamp: new Date().toISOString(),
          });
        } catch (geminiErr: any) {
          const latencyMs = Date.now() - startTime;
          const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);

          const isApiKeyInvalid =
            errMsg.includes('API_KEY_INVALID') ||
            errMsg.includes('API key not valid') ||
            errMsg.includes('API_KEY_SERVICE_BLOCKED') ||
            errMsg.includes('UNAUTHENTICATED') ||
            errMsg.includes('invalid authentication credentials') ||
            errMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
            errMsg.includes('401');

          if (isApiKeyInvalid) {
            return res.status(400).json({
              ok: false,
              provider: 'gemini',
              modelUsed: targetModel,
              latencyMs,
              code: 'API_KEY_INVALID',
              message: userKey
                ? 'API Key cá nhân bạn nhập không hợp lệ hoặc đã bị vô hiệu hóa (bắt đầu bằng AIzaSy...). Vui lòng kiểm tra lại tại Google AI Studio.'
                : 'Khóa API hệ thống chưa được cấu hình hoặc đã hết hạn. Vui lòng nhập Gemini API Key của bạn (bắt đầu bằng AIzaSy...) vào ô API Key.',
              errorDetails: errMsg,
              canFallbackToSystemKey: Boolean(userKey && systemKey),
            });
          }

          if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('is not supported')) {
            return res.status(400).json({
              ok: false,
              provider: 'gemini',
              modelUsed: targetModel,
              latencyMs,
              code: 'MODEL_NOT_FOUND',
              message: `Mô hình "${targetModel}" không tồn tại hoặc tài khoản của bạn chưa được cấp quyền sử dụng. Hãy thử chọn "gemini-3.1-flash-lite" hoặc "gemini-flash-latest".`,
              errorDetails: errMsg,
            });
          }

          return res.status(400).json({
            ok: false,
            provider: 'gemini',
            modelUsed: targetModel,
            latencyMs,
            code: 'API_ERROR',
            message: `Lỗi kết nối Gemini: ${errMsg}`,
            errorDetails: errMsg,
          });
        }
      }

      // Handle Claude (Anthropic)
      if (provider === 'claude') {
        if (!userKey) {
          return res.status(400).json({
            ok: false,
            provider: 'claude',
            code: 'API_KEY_MISSING',
            message: 'Vui lòng nhập Anthropic API Key (bắt đầu bằng sk-ant-...) để kiểm tra.',
          });
        }

        const targetModel = model?.trim() || 'claude-3-5-haiku-latest';
        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': userKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: targetModel,
            max_tokens: 15,
            messages: [{ role: 'user', content: 'Ping! Phản hồi 1 từ: OK' }],
          }),
        });

        const latencyMs = Date.now() - startTime;
        if (!claudeResp.ok) {
          const errData = (await claudeResp.json().catch(() => ({}))) as any;
          const errorMsg = errData?.error?.message || `HTTP ${claudeResp.status}`;
          return res.status(400).json({
            ok: false,
            provider: 'claude',
            modelUsed: targetModel,
            latencyMs,
            code: 'CLAUDE_ERROR',
            message: `Lỗi Anthropic Claude: ${errorMsg}`,
            errorDetails: errorMsg,
          });
        }

        const data = (await claudeResp.json()) as any;
        return res.json({
          ok: true,
          provider: 'claude',
          modelUsed: targetModel,
          latencyMs,
          keySource: 'custom',
          message: `Kết nối thành công tới Anthropic Claude (${targetModel})!`,
          sampleReply: data.content?.[0]?.text || 'OK',
        });
      }

      // Handle OpenAI / DeepSeek / OpenRouter / Custom (OpenAI compatible endpoints)
      let endpoint = customBaseUrl?.trim();
      if (!endpoint) {
        if (provider === 'openai') endpoint = 'https://api.openai.com/v1';
        else if (provider === 'deepseek') endpoint = 'https://api.deepseek.com';
        else if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1';
        else endpoint = 'https://api.openai.com/v1';
      }

      let url = endpoint;
      if (!url.endsWith('/chat/completions')) {
        url = url.replace(/\/+$/, '') + '/chat/completions';
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userKey) {
        headers['Authorization'] = `Bearer ${userKey}`;
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://ai.studio';
        headers['X-Title'] = 'Task Management Mascot';
      }

      const targetModel =
        model && model !== 'custom'
          ? model
          : provider === 'openai'
          ? 'gpt-4o-mini'
          : provider === 'deepseek'
          ? 'deepseek-chat'
          : provider === 'openrouter'
          ? 'meta-llama/llama-3.3-70b-instruct'
          : 'gpt-4o-mini';

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: 'Ping! Phản hồi 1 từ: OK' }],
          max_tokens: 15,
        }),
      });

      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const errData = (await resp.json().catch(() => ({}))) as any;
        const errorMsg = errData?.error?.message || errData?.message || `HTTP ${resp.status} ${resp.statusText}`;
        return res.status(400).json({
          ok: false,
          provider,
          modelUsed: targetModel,
          latencyMs,
          code: 'OPENAI_COMPATIBLE_ERROR',
          message: `Lỗi kết nối tới ${endpoint}: ${errorMsg}`,
          errorDetails: errorMsg,
        });
      }

      const data = (await resp.json()) as any;
      const textReply = data.choices?.[0]?.message?.content?.trim() || 'OK';

      return res.json({
        ok: true,
        provider,
        modelUsed: targetModel,
        latencyMs,
        keySource: 'custom',
        message: `Kết nối thành công tới ${provider.toUpperCase()} (${targetModel})!`,
        sampleReply: textReply,
      });
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'Lỗi kết nối không xác định';
      return res.status(500).json({
        ok: false,
        latencyMs,
        message: `Lỗi kiểm tra kết nối: ${errorMsg}`,
        errorDetails: errorMsg,
      });
    }
  });

  // Server In-Memory TTS Cache to save quota and provide 0ms instant audio playback
  const ttsAudioCache = new Map<string, Buffer>();

  // Mascot High-Quality Text-to-Speech (TTS) Route - Supports Vietnamese (vi) and English (en)
  app.get('/api/mascot/tts', async (req, res) => {
    try {
      const rawText = String(req.query.text || req.query.q || '').trim();
      const langParam = String(req.query.lang || 'vi').toLowerCase();
      const lang = langParam.startsWith('en') ? 'en' : 'vi';

      if (!rawText) {
        return res.status(400).json({ error: 'Tham số text không được để trống' });
      }

      // Helper to clean and split long text into pronounceable chunks (max ~170 chars per chunk)
      const clean = rawText
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/[#*_~>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!clean) {
        return res.status(400).json({ error: 'Nội dung văn bản rỗng sau khi làm sạch' });
      }

      // Check In-Memory Cache first
      const cacheKey = `${lang}:${clean.slice(0, 300)}`;
      if (ttsAudioCache.has(cacheKey)) {
        const cachedAudio = ttsAudioCache.get(cacheKey)!;
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': cachedAudio.length.toString(),
          'Cache-Control': 'public, max-age=86400',
          'X-TTS-Cache': 'HIT',
          'Accept-Ranges': 'bytes',
        });
        return res.send(cachedAudio);
      }

      // Sentence splitting
      const sentences = clean.split(/(?<=[.!?;\n])\s+/);
      const chunks: string[] = [];
      let currentChunk = '';

      for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;
        if ((currentChunk + ' ' + trimmed).trim().length <= 160) {
          currentChunk = currentChunk ? currentChunk + ' ' + trimmed : trimmed;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = '';
          }
          if (trimmed.length > 160) {
            const words = trimmed.split(' ');
            let wordChunk = '';
            for (const w of words) {
              if ((wordChunk + ' ' + w).trim().length <= 160) {
                wordChunk = wordChunk ? wordChunk + ' ' + w : w;
              } else {
                if (wordChunk) chunks.push(wordChunk);
                wordChunk = w;
              }
            }
            if (wordChunk) currentChunk = wordChunk;
          } else {
            currentChunk = trimmed;
          }
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      // Limit to 10 chunks to prevent abuse while ensuring full sentences
      const finalChunks = chunks.slice(0, 10);

      // Fetch each chunk from Google TTS
      const fetchChunk = (text: string): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(
            lang
          )}&q=${encodeURIComponent(text)}`;
          https
            .get(
              url,
              { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } },
              (ttsRes) => {
                if (ttsRes.statusCode !== 200) {
                  return reject(new Error(`TTS failed with status code ${ttsRes.statusCode}`));
                }
                const data: Buffer[] = [];
                ttsRes.on('data', (c) => data.push(c));
                ttsRes.on('end', () => resolve(Buffer.concat(data)));
              }
            )
            .on('error', reject);
        });
      };

      const audioBuffers = await Promise.all(finalChunks.map((c) => fetchChunk(c)));
      const fullAudio = Buffer.concat(audioBuffers);

      // Cache audio buffer in memory (limit cache to 250 items to keep memory tiny)
      if (ttsAudioCache.size > 250) {
        const firstKey = ttsAudioCache.keys().next().value;
        if (firstKey) ttsAudioCache.delete(firstKey);
      }
      ttsAudioCache.set(cacheKey, fullAudio);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': fullAudio.length.toString(),
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': 'bytes',
      });

      return res.send(fullAudio);
    } catch (err: unknown) {
      console.error('Mascot TTS error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Lỗi tạo giọng đọc TTS';
      return res.status(500).json({ error: errorMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
