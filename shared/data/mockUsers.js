export const mockUsers = [
  {
    id: "u1",
    name: "Alex Mercer",
    email: "alex@user.com",
    password: "password123",
    role: "user",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWbdkxUHzMNpHlhuEepdA0D8yV5Y0ET3mafJo0chhMbHmTLBoiW0Pv8Jz3GMbVlguA5X_VHSw5p0z7ZYAi11sfmwGMj1oJWct2qmaJJ0qxuOVFvnfivqzqvZHF2ny6faw7z3oqOozqkfABXrnOLFq2Gt1u5QpgF8aHphhC124Rf7vcqrbGGDuXukJi0hCuZKlHmWUSU872r5cBWkqKoSxYcjs1NClclPKyaFKLPQ5RyUMAFtSthKLR",
    phone: "+1 (555) 019-9234",
    isVerified: true,
    university: "State University",
    major: "Computer Science",
    age: 21,
    gender: "Male",
    budget: "$800 - $1,200",
    bio: "CS junior looking for a quiet study space and a friendly roommate. I enjoy hiking, coding side projects, and cooking.",
    preferences: {
      smoke: "No",
      pet: "No Pets",
      clean: "High",
      sleep: "Night Owl",
      social: "Medium",
      cooking: "Often"
    },
    hobbies: ["Coding", "Hiking", "Cooking", "Board Games"],
    properties: [],
    verificationDoc: {
      status: "Verified",
      type: "ID Document",
      submittedAt: "2026-08-10T10:00:00Z"
    }
  },
  {
    id: "u2",
    name: "Sarah Jenkins",
    email: "sarah@user.com",
    password: "password123",
    role: "user",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAVowSyn0Y52e0EGwYS3Ely-v3MBl0wjszIMqnt7Hd6kt7K96uItPn5PBGFW3PJSmnYkheCvCW8wiPn0Ij1IJXWPSZ5fUOHM62VC1AB0mhpEJCdTTQ8LljQK1akZFZ9-Xta5BnucEwsVe0-R2Ch5opYNOVDwM93TlD3vNkNiPvpWmAIgF49l5MpPKFZeUzNnICrg1zhBDhwsW1xvgYEwqD8BI81dTNNAKrWhPXhghzBYaRttVh__cyQ",
    phone: "+1 (555) 012-3456",
    isVerified: true,
    university: "City College",
    major: "Business Management",
    age: 28,
    gender: "Female",
    budget: "$1,000 - $1,500",
    bio: "Landlord with 5+ years of experience providing student-friendly housing near the main campus.",
    preferences: {
      smoke: "No",
      pet: "Pets Allowed",
      clean: "High",
      sleep: "Early Bird",
      social: "Medium",
      cooking: "Sometimes"
    },
    hobbies: ["Real Estate", "Gardening", "Cooking"],
    properties: [],
    verificationDoc: {
      status: "Verified",
      type: "ID Document",
      submittedAt: "2026-07-15T09:30:00Z"
    }
  },
  {
    id: "u3",
    name: "Admin",
    email: "admin@roomiematch.com",
    password: "password123",
    role: "admin",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCRer2CWk50SAt7tgIZKGCqvecJ5VOq3uQsSMC7bIihAjMstUr1jgwwlLyjNOs_fUktKPJihEtqdl64D3vuPTybwLVJJXhyX82YHmp0OpLAfoWolcvXarEnXPnxTjOy00rCwZJ0Xx2lDBagx9aQ11Op1oSwK2NU_drfoVt5slJOkv6gFesY89yl4b9340br__UnXQ5wkfuU4k-p0dh_7Nrmh1la56CtkvWFaqv8Lryz4xycHXIBvJqp",
    phone: "+1 (555) 015-8899",
    isVerified: true,
    department: "Platform Administration"
  },
  {
    id: "u4",
    name: "Marcus Brody",
    email: "marcus@user.com",
    password: "password123",
    role: "user",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuC6c4I0b0gIn_1sLvBNu8eni3NZ2KK1UArMcl8IXZj8vmgtXoTafm97gsa5TSyQXpR7tE1nzVFcX_EkRDsgMTM3A6GtUHKwX3fWkyZ3F1lMUGMwfkOXKl8ys1VNWBnVpS09vRfCzIg7SsUjm28ah-lVSF2BBjo2A29N0Yv0saI_vJqjefJcbduHi9pwCJUKSl3UpNC1ytb28NoIxMLhuFfTIYf70yo2P3aeTjKJ0SFBT0-HImeznIRW",
    phone: "+1 (555) 014-4589",
    isVerified: true,
    university: "State University",
    major: "Business Administration",
    age: 22,
    gender: "Male",
    budget: "$900 - $1,300",
    bio: "Outgoing senior in business. Very active, loves soccer, and is looking for a roommate who doesn't mind occasional study groups in the living room.",
    preferences: {
      smoke: "No",
      pet: "Pets Allowed",
      clean: "Medium",
      sleep: "Early Bird",
      social: "High",
      cooking: "Sometimes"
    },
    hobbies: ["Soccer", "Netflix", "Cooking", "Photography"],
    properties: [],
    verificationDoc: {
      status: "Verified",
      type: "ID Document",
      submittedAt: "2026-08-11T14:22:00Z"
    }
  },
  {
    id: "u5",
    name: "Chloe Henderson",
    email: "chloe@user.com",
    password: "password123",
    role: "user",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBy47hsK5Waz3XyvYoDPr16VkbS6xbJ9okD-OhfUHbpaR2fHx1pCzBnAkg7wY1_4d7A4CWjW8DV2f_WjWmP22uLxCzeIax7gAsH8PXwbymVE_iGPEQL5Suslg-pQ7SxcxKauRaycDgmagwDQJMknYeReVojp0HIp81w0vr66wEUSLzZK7zHe8WYhwBvC1vMfyhFsc9Vj3YndGfzpKFmkkZBMC_ScmLrsAgWU33Gj1NkF6Eo2U-0beuk",
    phone: "+1 (555) 017-7722",
    isVerified: false,
    university: "State University",
    major: "Graphic Design",
    age: 20,
    gender: "Female",
    budget: "$700 - $1,050",
    bio: "Sophomore doing graphic design. I keep my space very clean and decorated. Love indoor plants, cafe hopping, and listening to indie music.",
    preferences: {
      smoke: "No",
      pet: "Dog or Cat Allowed",
      clean: "High",
      sleep: "Night Owl",
      social: "High",
      cooking: "Often"
    },
    hobbies: ["Painting", "Indoor Plants", "Indie Music", "Thrifting"],
    properties: [],
    verificationDoc: {
      status: "Pending",
      type: "ID Document",
      submittedAt: "2026-08-18T16:45:00Z"
    }
  }
];
