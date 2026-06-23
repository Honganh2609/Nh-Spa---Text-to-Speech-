export interface PresetTemplate {
  id: string;
  title: string;
  category: "Gặp gỡ" | "Bản tin" | "Truyện" | "Học tập" | "Đánh giá & Du lịch";
  text: string;
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "greet-welcome",
    title: "Lời chào mừng",
    category: "Gặp gỡ",
    text: "Xin kính chào tất cả quý vị khách quý. Rất hân hạnh được chào đón quý vị tham gia sự kiện công nghệ đột phá hôm nay. Kính chúc quý khách có một ngày tuyệt vời và gặt hái được nhiều niềm vui, thành tựu mới.",
  },
  {
    id: "news-tech",
    title: "Bản tin Công nghệ",
    category: "Bản tin",
    text: "Chào mừng các bạn đã quay trở lại với Nhịp đập Số của chúng tôi. Sáng nay, mạng lưới trí tuệ nhân tạo thế hệ mới của Việt Nam đã chính thức ghi nhận số liệu kỷ lục với hơn mười triệu lượt tương tác chỉ trong vòng 24 giờ. Việt Nam hiện đang tiếp cận vô cùng nhanh chóng xu thế chuyển đổi công nghệ thế giới.",
  },
  {
    id: "review-spa",
    title: "Trải nghiệm Spa",
    category: "Đánh giá & Du lịch",
    text: "Hôm nay mình vừa có một buổi chiều thư giãn tuyệt vời tại trung tâm Trị liệu và Chăm sóc Sức khỏe An Nhiên Spa. Không gian ở đây ngập tràn hương thảo mộc tự nhiên cùng tiếng nhạc thiền êm dịu, giúp mình trút bỏ hoàn toàn mệt mỏi sau một tuần làm việc căng thẳng. Đội ngũ kỹ thuật viên tay nghề cao và vô cùng tinh tế, nhiệt tình tư vấn liệu trình massage đá nóng phù hợp. Đây chắc chắn là địa điểm mình sẽ ghé tới thường xuyên để chăm sóc bản thân.",
  },
  {
    id: "review-resort",
    title: "Đánh giá Khu nghỉ dưỡng",
    category: "Đánh giá & Du lịch",
    text: "Kỳ nghỉ ba ngày hai đêm tại khu nghỉ dưỡng ven biển Sunset Premier Resort thực sự đã vượt xa sự mong đợi của gia đình tôi. Hồ bơi vô cực rộng lớn sát bãi cát trắng mịn, mang đến tầm nhìn hoàng hôn tuyệt hảo mỗi buổi chiều tà. Phòng ốc trang nhã, thiết kế hiện đại sang trọng hòa quyện cùng thiên nhiên xanh mát. Đặc biệt nhất là dịch vụ chăm sóc khách hàng chu đáo tinh tế từ từng cử chỉ nhỏ của nhân viên. Đây xứng đáng là thiên đường nghỉ dưỡng năm sao hàng đầu.",
  },
  {
    id: "tour-da-lat",
    title: "Khám phá Đà Lạt",
    category: "Đánh giá & Du lịch",
    text: "Hành trình khám phá thành phố sương mù Đà Lạt luôn mang đến những cảm xúc ngọt ngào khó tả. Dạo bước quanh Hồ Xuân Hương dưới làn gió se lạnh sớm mai, hít căng lồng ngực mùi nhựa thông thơm nồng, hay thưởng thức một ly cà phê ấm nóng giữa đồi chè bát ngát. Những địa điểm check-in thơ mộng như Thung lũng Tình yêu hay làng cổ tích thực sự đã tạo nên những bức ảnh kỷ niệm lưu giữ thanh xuân tuyệt đẹp.",
  },
  {
    id: "review-food",
    title: "Review ẩm thực",
    category: "Đánh giá & Du lịch",
    text: "Một khám phá ẩm thực vô cùng bất ngờ tại nhà hàng Góc Phố Xưa tối qua! Món lẩu riêu cua sườn sụn ở đây mang hương vị nồng đượm, nước dùng thanh ngọt vị cua nguyên chất mà không hề bị gắt. Từng miếng gạch cua béo ngậy ăn kèm các loại rau rừng tươi rói tạo nên một tổng hòa hương vị khó quên. Mức giá vô cùng hợp lý cùng phong cách phục vụ nhanh chóng chính là điểm cộng lớn khiến mình muốn quay lại lần nữa.",
  },
  {
    id: "story-children",
    title: "Truyện Thỏ và Rùa",
    category: "Truyện",
    text: "Ngày xửa ngày xưa, ở một ngôi làng ven suối, chú Rùa nhỏ bộc bạch ước mơ chinh phục đỉnh núi. Nghe vậy, chú Thỏ cười ngặt nghẽo và nói: Cậu chậm thế kia thì bao giờ mới tới nơi! Rùa không nản lòng, chú vẫn kiên trì tiến bước từng bước một trong khi Thỏ đang bận ngủ say dưới gốc cây.",
  },
  {
    id: "edu-learn",
    title: "Tri thức hữu ích",
    category: "Học tập",
    text: "Các nghiên cứu khoa học hành vi chứng minh rằng: Việc lắng nghe trực quan tài liệu văn bản bằng âm thanh chất lượng cao hỗ trợ tăng cường khả năng tập trung và cải thiện trí nhớ lên đến bốn mươi phần trăm so với việc chỉ đọc lướt bằng mắt thông thường.",
  }
];
